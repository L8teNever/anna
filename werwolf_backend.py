"""Werwolf – Online-Mehrgeräte-Backend (einziges Spiel dieser App mit
echter Server-Spiellogik, siehe Docstring in server.py).

Alles läuft rein im Arbeitsspeicher (ein Prozess, ein `threading.Lock`
schützt das gemeinsame `ROOMS`-Dict) – nichts wird auf Platte persistiert.
Räume verfallen nach Inaktivität automatisch (`ROOM_TTL_SECONDS`) oder wenn
der Host explizit beendet. Das ist bewusst so gehalten (Datensparsamkeit,
DSGVO) UND hält den Server stdlib-only (keine neue Abhängigkeit, kein neuer
Prozess, keine Datenbank).

Sicherheit:
  - Raum-/Spieler-Token = 128 Bit Zufall (`secrets.token_urlsafe`), NIE
    erratbar/durchprobierbar. Es gibt absichtlich KEINEN Endpunkt, der alle
    Räume auflistet – ein Raum ist nur erreichbar, wer den exakten Token
    schon hat (aus QR-Code/Link).
  - Host-Token ist vom Spieler-Token/Join-Link komplett getrennt.
  - Beitritt nur, solange `phase == "lobby"`.
  - Einfaches In-Memory-Rate-Limiting pro IP auf den Endpunkten, die ein
    Außenstehender missbrauchen könnte (join/action/vote).
"""

from __future__ import annotations

import json
import random
import re
import secrets
import threading
import time
import uuid
from dataclasses import dataclass, field

ROOM_TTL_SECONDS = 6 * 60 * 60  # 6h Inaktivität -> Raum verfällt
RATE_LIMIT_WINDOW = 10.0
RATE_LIMIT_MAX_REQUESTS = 20
STREAM_POLL_INTERVAL = 1.0
STREAM_HEARTBEAT_INTERVAL = 20.0

MIN_PLAYERS = 4
MAX_PLAYERS = 20

ROLE_LABELS = {
    "werwolf": "Werwolf",
    "dorfbewohner": "Dorfbewohner",
    "seherin": "Seherin",
    "hexe": "Hexe",
    "amor": "Amor",
    "jaeger": "Jäger",
}


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# --------------------------------------------------------------------- #
# Datenmodell
# --------------------------------------------------------------------- #

@dataclass
class Player:
    player_id: str
    player_token: str
    name: str
    is_host: bool = False
    role: str | None = None
    alive: bool = True
    connected: bool = True
    love_linked_with: str | None = None
    # Hat die Runde aktiv verlassen (Zurück-Button + bestätigt). Anders als
    # "not connected" (kurzer Netzwerk-Aussetzer) ist das endgültig: eine
    # verlassene Person zählt nirgends mehr mit, damit die Gruppe nie auf
    # eine Bestätigung/Stimme wartet, die nie mehr kommt.
    left: bool = False


@dataclass
class Room:
    token: str
    host_token: str
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    version: int = 0

    phase: str = "lobby"  # lobby | night | day | ended
    step: str = ""
    round: int = 1
    role_config: dict = field(default_factory=lambda: {
        "werwolfCount": 1, "seherin": False, "hexe": False, "amor": False, "jaeger": False,
    })
    # Sollen die Sprachansagen (Nacht/Tag-Ansagen) auf JEDEM verbundenen
    # Gerät laufen, oder nur auf dem des Hosts? Unabhängig davon kann jedes
    # Gerät sich zusätzlich rein lokal selbst stummschalten (siehe Client).
    announce_all_devices: bool = True
    players: dict[str, Player] = field(default_factory=dict)

    night_victim: str | None = None
    night_healed: bool = False
    night_poison: str | None = None
    witch_heal_used: bool = False
    witch_poison_used: bool = False
    pending_hunters: list[str] = field(default_factory=list)
    last_deaths: list[str] = field(default_factory=list)
    winner: str | None = None
    pending_votes: dict[str, str | None] = field(default_factory=dict)
    # Wer hat schon bestätigt? Wiederverwendet für zwei Synchronisations-
    # Barrieren: Rollen-Enthüllung ("reveal", alle müssen ihre Rolle gesehen
    # haben, bevor die erste Nacht beginnt) und Tages-Diskussion
    # ("day-discussion", alle Lebenden müssen "bereit" klicken, bevor die
    # Abstimmung öffnet). Niemand steuert das für die Gruppe - der letzte
    # Bestätigende löst automatisch den nächsten Schritt für alle aus.
    pending_acks: set[str] = field(default_factory=set)

    def touch(self):
        self.last_activity = time.time()
        self.version += 1

    def player_order(self) -> list[Player]:
        return list(self.players.values())

    def find_by_token(self, player_token: str) -> Player | None:
        for p in self.players.values():
            if p.player_token == player_token:
                return p
        return None

    def alive_players(self) -> list[Player]:
        return [p for p in self.players.values() if p.alive and not p.left]

    def active_players(self) -> list[Player]:
        """Alle, die die Runde noch nicht verlassen haben (unabhängig von
        lebendig/tot) - für Schwellenwerte wie die Rollen-Bestätigung, bei
        der auch Tote/noch-Lebende gemeinsam zählen."""
        return [p for p in self.players.values() if not p.left]

    def role_index_player(self, role: str) -> Player | None:
        for p in self.players.values():
            if p.role == role:
                return p
        return None


LOCK = threading.Lock()
ROOMS: dict[str, Room] = {}

# IP -> Liste von Timestamps (nur für rate-limited Endpunkte)
_RATE_BUCKETS: dict[str, list[float]] = {}


def _rate_limited(client_ip: str) -> bool:
    now = time.time()
    bucket = _RATE_BUCKETS.setdefault(client_ip, [])
    bucket[:] = [t for t in bucket if now - t < RATE_LIMIT_WINDOW]
    if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
        return True
    bucket.append(now)
    return False


def _cleanup_expired_locked():
    now = time.time()
    expired = [t for t, r in ROOMS.items() if now - r.last_activity > ROOM_TTL_SECONDS]
    for t in expired:
        del ROOMS[t]


def _make_token() -> str:
    return secrets.token_urlsafe(16)


def _shuffle(items: list):
    return random.sample(items, len(items))


# --------------------------------------------------------------------- #
# Rollen / Zustandsmaschine (spiegelt exakt die clientseitige Einzelgerät-
# Logik in public/games/werwolf/werwolf.js, jetzt serverseitig autoritativ)
# --------------------------------------------------------------------- #

def _build_roles(role_config: dict, count: int) -> list[str] | None:
    bag = ["werwolf"] * max(1, int(role_config.get("werwolfCount", 1)))
    if role_config.get("seherin"):
        bag.append("seherin")
    if role_config.get("hexe"):
        bag.append("hexe")
    if role_config.get("amor"):
        bag.append("amor")
    if role_config.get("jaeger"):
        bag.append("jaeger")
    if len(bag) > count:
        return None
    bag.extend(["dorfbewohner"] * (count - len(bag)))
    return _shuffle(bag)


def _tally(votes: dict[str, str | None]) -> str | None:
    """Mehrheitswahl. Bei Gleichstand oder keinen Stimmen: kein Ergebnis
    (None) - bewusst einheitliche, einfache Regel für Werwolf-Opfer UND
    Tages-Abstimmung, statt unterschiedlicher Tie-Break-Sonderfälle."""
    counts: dict[str, int] = {}
    for target in votes.values():
        if target is None:
            continue
        counts[target] = counts.get(target, 0) + 1
    if not counts:
        return None
    best = max(counts.values())
    winners = [t for t, c in counts.items() if c == best]
    return winners[0] if len(winners) == 1 else None


def _resolve_love_chain(room: Room, deaths: set[str]):
    changed = True
    while changed:
        changed = False
        for p in room.players.values():
            if p.love_linked_with and p.player_id in deaths and p.alive and p.love_linked_with not in deaths:
                partner = room.players.get(p.love_linked_with)
                if partner and partner.alive:
                    deaths.add(partner.player_id)
                    changed = True
    return deaths


def _next_night_step(room: Room, after: str):
    if after == "werwolf":
        seherin = room.role_index_player("seherin")
        if seherin and seherin.alive:
            room.step = "seherin"
            return
        hexe = room.role_index_player("hexe")
        if hexe and hexe.alive:
            room.step = "hexe-heal"
            return
        _resolve_night(room)
        return
    if after == "seherin":
        hexe = room.role_index_player("hexe")
        if hexe and hexe.alive:
            room.step = "hexe-heal"
            return
        _resolve_night(room)
        return


def _start_night(room: Room):
    room.night_victim = None
    room.night_healed = False
    room.night_poison = None
    room.pending_votes = {}
    room.pending_acks = set()
    amor = room.role_index_player("amor")
    if room.round == 1 and amor and amor.alive and not amor.love_linked_with:
        room.step = "amor"
    else:
        room.step = "werwolf"
    room.phase = "night"


def _resolve_night(room: Room):
    deaths: set[str] = set()
    if room.night_victim and not room.night_healed:
        deaths.add(room.night_victim)
    if room.night_poison:
        deaths.add(room.night_poison)
    deaths = _resolve_love_chain(room, deaths)
    for pid in deaths:
        room.players[pid].alive = False
    room.last_deaths = list(deaths)
    room.pending_hunters = [pid for pid in deaths if room.players[pid].role == "jaeger"]
    room.phase = "day"
    # Anders als im Einzelgerät-Modus gibt es hier kein einzelnes
    # Moderator-Gerät, das den "Weiter"-Klick nach der Nacht-Enthüllung
    # macht - jedes Gerät liest die Enthüllung selbst in seinem eigenen
    # Tempo, daher hier direkt weiter zu hunter-shot/day-discussion.
    _after_day_reveal(room)


def _check_win(room: Room) -> bool:
    alive_wolves = sum(1 for p in room.players.values() if p.alive and not p.left and p.role == "werwolf")
    alive_others = sum(1 for p in room.players.values() if p.alive and not p.left and p.role != "werwolf")
    if alive_wolves == 0:
        room.phase = "ended"
        room.step = "ended"
        room.winner = "dorf"
        return True
    if alive_wolves >= alive_others:
        room.phase = "ended"
        room.step = "ended"
        room.winner = "werwolf"
        return True
    return False


def _after_day_reveal(room: Room):
    if _check_win(room):
        return
    if room.pending_hunters:
        room.step = "hunter-shot"
    else:
        room.step = "day-discussion"
        room.pending_acks = set()


def _apply_hunter_shot(room: Room, target_id: str):
    hunter_id = room.pending_hunters.pop(0)
    deaths = {target_id}
    deaths = _resolve_love_chain(room, deaths)
    for pid in deaths:
        room.players[pid].alive = False
    room.last_deaths = list(set(room.last_deaths) | deaths)
    for pid in deaths:
        if room.players[pid].role == "jaeger" and pid != hunter_id and pid not in room.pending_hunters:
            room.pending_hunters.append(pid)
    if _check_win(room):
        return
    if room.pending_hunters:
        room.step = "hunter-shot"
    else:
        room.step = "day-discussion"
        room.pending_acks = set()


def _resolve_day_vote(room: Room):
    target_id = _tally(room.pending_votes)
    if target_id is None:
        room.last_deaths = []
    else:
        deaths = {target_id}
        deaths = _resolve_love_chain(room, deaths)
        for pid in deaths:
            room.players[pid].alive = False
        room.last_deaths = list(deaths)
        room.pending_hunters = [pid for pid in deaths if room.players[pid].role == "jaeger"]
    if _check_win(room):
        return
    if room.pending_hunters:
        room.step = "hunter-shot"
        return
    room.round += 1
    _start_night(room)


# --------------------------------------------------------------------- #
# Öffentliche API, von server.py aufgerufen
# --------------------------------------------------------------------- #

_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{10,64}$")


def _get_room(token: str) -> Room:
    """Muss immer unter LOCK aufgerufen werden. Räumt nebenbei abgelaufene
    Räume weg, damit auch ein Raum, den niemand sonst mehr anfasst (z.B. nur
    noch ein offener SSE-Stream pollt ihn), irgendwann wirklich verschwindet."""
    if not _TOKEN_RE.match(token or ""):
        raise ApiError(404, "Unbekannter Raum")
    room = ROOMS.get(token)
    if room is None:
        raise ApiError(404, "Unbekannter oder abgelaufener Raum")
    if time.time() - room.last_activity > ROOM_TTL_SECONDS:
        del ROOMS[token]
        raise ApiError(404, "Unbekannter oder abgelaufener Raum")
    return room


def create_room(body: dict, client_ip: str) -> dict:
    with LOCK:
        _cleanup_expired_locked()
        token = _make_token()
        while token in ROOMS:
            token = _make_token()
        host_token = _make_token()
        room = Room(token=token, host_token=host_token)
        host_name = str(body.get("hostName") or "Host").strip()[:30] or "Host"
        host = Player(player_id=str(uuid.uuid4()), player_token=_make_token(), name=host_name, is_host=True)
        room.players[host.player_id] = host
        room.touch()
        ROOMS[token] = room
        return {
            "roomToken": room.token,
            "hostToken": room.host_token,
            "playerId": host.player_id,
            "playerToken": host.player_token,
        }


def join_room(token: str, body: dict, client_ip: str) -> dict:
    if _rate_limited(client_ip):
        raise ApiError(429, "Zu viele Anfragen - bitte kurz warten")
    with LOCK:
        room = _get_room(token)
        if room.phase != "lobby":
            raise ApiError(409, "Die Runde läuft bereits")
        if len(room.players) >= MAX_PLAYERS:
            raise ApiError(409, "Der Raum ist voll")
        name = str(body.get("name") or "").strip()[:30]
        if not name:
            raise ApiError(400, "Bitte einen Namen angeben")
        existing_names = {p.name.lower() for p in room.players.values()}
        if name.lower() in existing_names:
            raise ApiError(409, "Name schon vergeben - bitte einen anderen wählen")
        player = Player(player_id=str(uuid.uuid4()), player_token=_make_token(), name=name)
        room.players[player.player_id] = player
        room.touch()
        return {"playerId": player.player_id, "playerToken": player.player_token}


def rejoin_room(token: str, body: dict, client_ip: str) -> dict:
    with LOCK:
        room = _get_room(token)
        player_token = str(body.get("playerToken") or "")
        player = room.find_by_token(player_token)
        if player is None:
            raise ApiError(404, "Sitzung nicht mehr gültig")
        player.connected = True
        room.touch()
        return snapshot_for(room, player)


def configure_room(token: str, body: dict, client_ip: str) -> dict:
    with LOCK:
        room = _get_room(token)
        _require_host(room, body)
        if room.phase != "lobby":
            raise ApiError(409, "Rollen können nur in der Lobby geändert werden")
        cfg = body.get("roleConfig") or {}
        room.role_config = {
            "werwolfCount": max(1, int(cfg.get("werwolfCount", 1))),
            "seherin": bool(cfg.get("seherin")),
            "hexe": bool(cfg.get("hexe")),
            "amor": bool(cfg.get("amor")),
            "jaeger": bool(cfg.get("jaeger")),
        }
        if "announceAllDevices" in body:
            room.announce_all_devices = bool(body.get("announceAllDevices"))
        room.touch()
        return {"roleConfig": room.role_config, "announceAllDevices": room.announce_all_devices}


def start_room(token: str, body: dict, client_ip: str) -> dict:
    with LOCK:
        room = _get_room(token)
        _require_host(room, body)
        if room.phase != "lobby":
            raise ApiError(409, "Die Runde läuft bereits")
        players = room.player_order()
        if not (MIN_PLAYERS <= len(players) <= MAX_PLAYERS):
            raise ApiError(400, f"Es werden {MIN_PLAYERS}-{MAX_PLAYERS} Mitspieler benötigt (aktuell {len(players)})")
        roles = _build_roles(room.role_config, len(players))
        if roles is None:
            raise ApiError(400, "Zu viele Rollen für so wenige Spieler ausgewählt")
        for p, role in zip(players, roles):
            p.role = role
            p.alive = True
            p.love_linked_with = None
        room.witch_heal_used = False
        room.witch_poison_used = False
        room.round = 1
        room.winner = None
        # Erst mal alle ihre Rolle bestätigen lassen (siehe ack_role) - die
        # eigentliche erste Nacht (_start_night) beginnt erst, wenn die
        # letzte Person bestätigt hat, damit niemand mitten in der eigenen
        # Rollen-Enthüllung von der schon laufenden Nacht überrascht wird.
        room.phase = "reveal"
        room.step = "reveal"
        room.pending_acks = set()
        room.touch()
        return {"ok": True}


def submit_action(token: str, body: dict, client_ip: str) -> dict:
    if _rate_limited(client_ip):
        raise ApiError(429, "Zu viele Anfragen - bitte kurz warten")
    with LOCK:
        room = _get_room(token)
        player = _require_player(room, body)
        action = str(body.get("action") or "")

        result = None
        if room.step == "amor":
            _handle_amor(room, player, body)
        elif room.step == "werwolf":
            _handle_werwolf_vote(room, player, body)
        elif room.step == "seherin":
            # Die Seherin bekommt ihr Ergebnis direkt in dieser Antwort
            # zurück, NICHT über den nächsten Snapshot-Poll - der Schritt
            # ist zu diesem Zeitpunkt schon weitergerückt (siehe
            # _next_night_step), ein späterer Poll würde es nie mehr zeigen.
            result = _handle_seherin(room, player, body)
        elif room.step == "hexe-heal":
            _handle_hexe_heal(room, player, action)
        elif room.step == "hexe-poison":
            _handle_hexe_poison(room, player, body)
        elif room.step == "hunter-shot":
            _handle_hunter_shot(room, player, body)
        elif room.step == "day-vote":
            _handle_day_vote(room, player, body)
        else:
            raise ApiError(409, "Gerade ist keine Aktion möglich")

        room.touch()
        return {"ok": True, "result": result}


def ack_role(token: str, body: dict, client_ip: str) -> dict:
    """Jede Person bestätigt, dass sie ihre Rolle gesehen hat. Erst wenn
    ALLE bestätigt haben, beginnt für alle gleichzeitig die erste Nacht -
    sonst könnte jemand mitten in der eigenen Rollen-Enthüllung von einer
    schon laufenden Nacht überrascht werden."""
    with LOCK:
        room = _get_room(token)
        player = _require_player(room, body)
        if room.phase != "reveal":
            raise ApiError(409, "Gerade keine Rollen-Bestätigung möglich")
        room.pending_acks.add(player.player_id)
        if len(room.pending_acks) >= len(room.active_players()):
            _start_night(room)
        room.touch()
        return {"ok": True}


def discussion_ready(token: str, body: dict, client_ip: str) -> dict:
    """Jede lebende Person bestätigt, dass sie mit der Diskussion fertig
    ist. Erst wenn ALLE bereit sind, öffnet die Abstimmung für alle
    gleichzeitig - kein einzelnes Gerät bestimmt das Tempo der anderen."""
    with LOCK:
        room = _get_room(token)
        player = _require_player(room, body)
        if room.step != "day-discussion":
            raise ApiError(409, "Gerade nicht in der Diskussionsphase")
        if not player.alive:
            raise ApiError(403, "Tote Spieler entscheiden das nicht mit")
        room.pending_acks.add(player.player_id)
        if len(room.pending_acks) >= len(room.alive_players()):
            room.step = "day-vote"
            room.pending_votes = {}
            room.pending_acks = set()
        room.touch()
        return {"ok": True}


def force_advance(token: str, body: dict, client_ip: str) -> dict:
    """Host-Override: aktuellen Schritt auch ohne alle Bestätigungen/Stimmen
    weiterschieben (z.B. wenn ein Gerät ausgefallen ist und die Gruppe sonst
    ewig auf eine Bestätigung wartet, die nie kommt)."""
    with LOCK:
        room = _get_room(token)
        _require_host(room, body)
        if room.phase == "reveal":
            _start_night(room)
        elif room.step == "amor":
            room.step = "werwolf"
        elif room.step == "werwolf":
            _resolve_werwolf_step(room)
        elif room.step == "seherin":
            _next_night_step(room, "seherin")
        elif room.step == "hexe-heal":
            room.step = "hexe-poison"
        elif room.step == "hexe-poison":
            _resolve_night(room)
        elif room.step == "hunter-shot":
            if room.pending_hunters:
                room.pending_hunters.pop(0)
            if not _check_win(room) and not room.pending_hunters:
                room.step = "day-discussion"
                room.pending_acks = set()
        elif room.step == "day-discussion":
            room.step = "day-vote"
            room.pending_votes = {}
            room.pending_acks = set()
        elif room.step == "day-vote":
            _resolve_day_vote(room)
        room.touch()
        return {"ok": True}


def end_room(token: str, body: dict, client_ip: str) -> dict:
    with LOCK:
        room = _get_room(token)
        _require_host(room, body)
        del ROOMS[token]
        return {"ok": True}


def leave_room(token: str, body: dict, client_ip: str) -> dict:
    """Eine (nicht-Host-)Person verlässt die Runde aktiv und endgültig
    (Zurück-Button + bestätigt) - zählt ab sofort nirgends mehr mit
    (Bestätigungen, Stimmen, Sieg-Bedingung), damit die Gruppe nie auf eine
    Aktion warten muss, die nie mehr kommt. Der Host beendet die Runde
    stattdessen komplett (siehe end_room)."""
    with LOCK:
        room = _get_room(token)
        player = _require_player(room, body)
        if player.is_host:
            raise ApiError(400, "Der Host muss die Runde stattdessen beenden")
        if room.phase == "lobby":
            del room.players[player.player_id]
            room.touch()
            return {"ok": True}
        player.left = True
        player.connected = False
        _recheck_after_leave(room)
        room.touch()
        return {"ok": True}


def reset_room(token: str, body: dict, client_ip: str) -> dict:
    """Host-Aktion nach Spielende: zurück in die Lobby, gleiche Mitspieler
    und Rollen-Konfiguration, damit man für eine neue Runde nicht erneut per
    QR-Code/Link beitreten muss. Wer die vorherige Runde verlassen hatte,
    wird dabei ganz entfernt (müsste über den Link neu beitreten)."""
    with LOCK:
        room = _get_room(token)
        _require_host(room, body)
        if room.phase != "ended":
            raise ApiError(409, "Die Runde läuft noch")
        room.players = {pid: p for pid, p in room.players.items() if not p.left}
        for p in room.players.values():
            p.role = None
            p.alive = True
            p.love_linked_with = None
        room.phase = "lobby"
        room.step = ""
        room.round = 1
        room.night_victim = None
        room.night_healed = False
        room.night_poison = None
        room.witch_heal_used = False
        room.witch_poison_used = False
        room.pending_hunters = []
        room.last_deaths = []
        room.winner = None
        room.pending_votes = {}
        room.touch()
        return {"ok": True}


def snapshot_for(room: Room, player: Player) -> dict:
    players_public = [{
        "playerId": p.player_id,
        "name": p.name,
        "alive": p.alive,
        "connected": p.connected,
        "isHost": p.is_host,
        "isYou": p.player_id == player.player_id,
        "left": p.left,
    } for p in room.player_order()]

    my_turn, my_action = _compute_my_turn(room, player)
    wolf_pack = None
    if player.role == "werwolf":
        wolf_pack = [p.name for p in room.players.values() if p.role == "werwolf" and p.player_id != player.player_id]

    ready_gate = None
    if room.phase == "reveal":
        ready_gate = {"acked": len(room.pending_acks), "total": len(room.active_players()), "youAcked": player.player_id in room.pending_acks}
    elif room.step == "day-discussion":
        ready_gate = {"acked": len(room.pending_acks), "total": len(room.alive_players()), "youAcked": player.player_id in room.pending_acks}

    return {
        "roomToken": room.token,
        "isHost": player.is_host,
        "phase": room.phase,
        "step": room.step,
        "round": room.round,
        "players": players_public,
        "myPlayerId": player.player_id,
        "myRole": player.role,
        "myRoleLabel": ROLE_LABELS.get(player.role) if player.role else None,
        "myAlive": player.alive,
        "isMyTurn": my_turn,
        "myAction": my_action,
        "publicStatus": _public_status(room),
        "lastDeaths": [{"name": room.players[pid].name, "role": ROLE_LABELS.get(room.players[pid].role)} for pid in room.last_deaths if pid in room.players] if room.phase in ("day", "ended") else [],
        "wolfPack": wolf_pack,
        "winner": room.winner,
        "readyGate": ready_gate,
        "announceAllDevices": room.announce_all_devices,
        "minPlayers": MIN_PLAYERS,
        "maxPlayers": MAX_PLAYERS,
    }


def stream_snapshot(token: str, player_token: str) -> tuple[dict, int]:
    with LOCK:
        room = _get_room(token)
        player = room.find_by_token(player_token)
        if player is None:
            raise ApiError(404, "Sitzung nicht mehr gültig")
        return snapshot_for(room, player), room.version


# --------------------------------------------------------------------- #
# HTTP-Dispatch (von server.py aufgerufen)
# --------------------------------------------------------------------- #

_POST_HANDLERS = {
    "join": join_room,
    "rejoin": rejoin_room,
    "config": configure_room,
    "start": start_room,
    "action": submit_action,
    "ack-role": ack_role,
    "discussion-ready": discussion_ready,
    "force-advance": force_advance,
    "end": end_room,
    "leave": leave_room,
    "reset": reset_room,
}


def handle_post(segments: list[str], body: dict, client_ip: str) -> dict:
    """segments = Pfadteile NACH '/api/werwolf/', z.B. ['rooms'] oder
    ['rooms', '<token>', 'join']."""
    if segments == ["rooms"]:
        return create_room(body, client_ip)
    if len(segments) == 3 and segments[0] == "rooms":
        token, action = segments[1], segments[2]
        handler = _POST_HANDLERS.get(action)
        if handler:
            return handler(token, body, client_ip)
    raise ApiError(404, "Unbekannter Endpunkt")


def _write_sse(wfile, event: str, data: dict):
    payload = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    wfile.write(payload.encode("utf-8"))
    wfile.flush()


def stream_room(token: str, player_token: str, wfile) -> None:
    """Schreibt SSE-Events auf wfile, bis der Client die Verbindung trennt
    (erkannt am fehlgeschlagenen Schreibversuch) oder der Raum verschwindet.
    server.py ruft das aus dem Verbindungs-Thread auf (ein Thread pro
    Verbindung dank ThreadingHTTPServer) und kümmert sich vorher um die
    SSE-HTTP-Header."""
    last_version = -1
    last_heartbeat = time.time()
    while True:
        try:
            snapshot, version = stream_snapshot(token, player_token)
        except ApiError as exc:
            try:
                # Eigener Event-Name statt "error": der Browser-EventSource
                # hat bereits ein eingebautes "error"-Event für abgebrochene
                # Verbindungen - ein gleichnamiges eigenes Event wäre dort
                # nicht mehr eindeutig unterscheidbar.
                _write_sse(wfile, "room-error", {"message": exc.message})
            except OSError:
                pass
            return

        now = time.time()
        try:
            if version != last_version:
                _write_sse(wfile, "state", snapshot)
                last_version = version
                last_heartbeat = now
            elif now - last_heartbeat >= STREAM_HEARTBEAT_INTERVAL:
                wfile.write(b": ping\n\n")
                wfile.flush()
                last_heartbeat = now
        except OSError:
            return
        time.sleep(STREAM_POLL_INTERVAL)


# --------------------------------------------------------------------- #
# Interne Helfer
# --------------------------------------------------------------------- #

def _require_host(room: Room, body: dict):
    if str(body.get("hostToken") or "") != room.host_token:
        raise ApiError(403, "Nur der Host darf das")


def _require_player(room: Room, body: dict) -> Player:
    player = room.find_by_token(str(body.get("playerToken") or ""))
    if player is None:
        raise ApiError(403, "Unbekannte Sitzung")
    return player


def _alive_ids_with_role(room: Room, role_filter: str) -> list[str]:
    return [p.player_id for p in room.players.values() if p.alive and not p.left and p.role == role_filter]


def _handle_amor(room: Room, player: Player, body: dict):
    if player.role != "amor" or not player.alive:
        raise ApiError(403, "Du bist gerade nicht dran")
    ids = body.get("targetPlayerIds")
    if not isinstance(ids, list) or len(ids) != 2 or ids[0] == ids[1]:
        raise ApiError(400, "Bitte zwei unterschiedliche Personen wählen")
    for pid in ids:
        if pid not in room.players or not room.players[pid].alive:
            raise ApiError(400, "Ungültige Auswahl")
    room.players[ids[0]].love_linked_with = ids[1]
    room.players[ids[1]].love_linked_with = ids[0]
    room.step = "werwolf"


def _wolf_votes_summary(room: Room):
    """Liste, wer von den (lebenden) Werwölfen aktuell für wen gestimmt hat
    - den Werwölfen gegenseitig sichtbar, damit sie sich absprechen können,
    wie am echten Spieltisch. Gibt außerdem zurück, ob sich schon alle auf
    dieselbe Person geeinigt haben (Voraussetzung fürs Bestätigen)."""
    wolves = [p for p in room.players.values() if p.alive and not p.left and p.role == "werwolf"]
    entries = []
    values = []
    for w in wolves:
        target_id = room.pending_votes.get(w.player_id)
        target_name = room.players[target_id].name if target_id and target_id in room.players else None
        entries.append({
            "playerId": w.player_id,
            "name": w.name,
            "votedForName": target_name,
            "confirmed": w.player_id in room.pending_acks,
        })
        values.append(target_id)
    all_agreed = bool(values) and all(v is not None and v == values[0] for v in values)
    return entries, all_agreed


def _recheck_after_leave(room: Room):
    """Nachdem jemand die laufende Runde verlassen hat: prüfen, ob die
    gerade wartende Schwelle (Rollen-Bestätigung/Werwolf-Einigung/
    Diskussions-Bereitschaft/Tages-Abstimmung) dadurch jetzt erst erreicht
    ist - sonst würde die Gruppe endlos auf eine Bestätigung/Stimme warten,
    die nie mehr kommen kann."""
    if room.phase == "reveal":
        eligible = {p.player_id for p in room.active_players()}
        if eligible and eligible <= room.pending_acks:
            _start_night(room)
        return
    if room.step == "werwolf":
        eligible = set(_alive_ids_with_role(room, "werwolf"))
        if eligible and eligible <= room.pending_acks:
            _, all_agreed = _wolf_votes_summary(room)
            if all_agreed:
                _resolve_werwolf_step(room)
            else:
                room.pending_acks = set()
        return
    if room.step == "day-discussion":
        eligible = {p.player_id for p in room.alive_players()}
        if eligible and eligible <= room.pending_acks:
            room.step = "day-vote"
            room.pending_votes = {}
            room.pending_acks = set()
        return
    if room.step == "day-vote":
        eligible = {p.player_id for p in room.alive_players()}
        if eligible and eligible <= room.pending_votes.keys():
            _resolve_day_vote(room)
        return


def _resolve_werwolf_step(room: Room):
    target = _tally(room.pending_votes)
    room.night_victim = target
    room.pending_acks = set()
    _next_night_step(room, "werwolf")


def _handle_werwolf_vote(room: Room, player: Player, body: dict):
    if player.role != "werwolf" or not player.alive:
        raise ApiError(403, "Du bist gerade nicht dran")

    if str(body.get("action") or "") == "confirm":
        room.pending_acks.add(player.player_id)
        eligible = _alive_ids_with_role(room, "werwolf")
        if len(room.pending_acks) >= len(eligible):
            _, all_agreed = _wolf_votes_summary(room)
            if all_agreed:
                _resolve_werwolf_step(room)
            else:
                # Doch nicht einig (z.B. jemand hat in letzter Sekunde
                # umentschieden) - alle müssen erneut bestätigen.
                room.pending_acks = set()
        return

    target_id = body.get("targetPlayerId")
    if target_id is not None and (target_id not in room.players or not room.players[target_id].alive or room.players[target_id].role == "werwolf"):
        raise ApiError(400, "Ungültiges Ziel")
    room.pending_votes[player.player_id] = target_id
    # Jede Änderung der eigenen Wahl setzt alle bisherigen Bestätigungen
    # zurück - eine "alte" Bestätigung darf nie für ein neues Ziel gelten.
    room.pending_acks = set()


def _handle_seherin(room: Room, player: Player, body: dict) -> dict:
    if player.role != "seherin" or not player.alive:
        raise ApiError(403, "Du bist gerade nicht dran")
    target_id = body.get("targetPlayerId")
    if target_id not in room.players or not room.players[target_id].alive:
        raise ApiError(400, "Ungültiges Ziel")
    peek = {"type": "seherin-result", "targetName": room.players[target_id].name, "targetRole": ROLE_LABELS.get(room.players[target_id].role)}
    _next_night_step(room, "seherin")
    return peek


def _handle_hexe_heal(room: Room, player: Player, action: str):
    if player.role != "hexe" or not player.alive:
        raise ApiError(403, "Du bist gerade nicht dran")
    if action == "heal-yes" and not room.witch_heal_used and room.night_victim:
        room.night_healed = True
        room.witch_heal_used = True
    room.step = "hexe-poison"


def _handle_hexe_poison(room: Room, player: Player, body: dict):
    if player.role != "hexe" or not player.alive:
        raise ApiError(403, "Du bist gerade nicht dran")
    action = str(body.get("action") or "")
    if action == "poison" and not room.witch_poison_used:
        target_id = body.get("targetPlayerId")
        if target_id not in room.players or not room.players[target_id].alive:
            raise ApiError(400, "Ungültiges Ziel")
        room.night_poison = target_id
        room.witch_poison_used = True
    _resolve_night(room)


def _handle_hunter_shot(room: Room, player: Player, body: dict):
    if not room.pending_hunters or player.player_id != room.pending_hunters[0]:
        raise ApiError(403, "Du bist gerade nicht dran")
    target_id = body.get("targetPlayerId")
    if target_id not in room.players or not room.players[target_id].alive:
        raise ApiError(400, "Ungültiges Ziel")
    _apply_hunter_shot(room, target_id)


def _handle_day_vote(room: Room, player: Player, body: dict):
    if not player.alive:
        raise ApiError(403, "Tote Spieler stimmen nicht mit ab")
    target_id = body.get("targetPlayerId")
    if target_id is not None and (target_id not in room.players or not room.players[target_id].alive):
        raise ApiError(400, "Ungültiges Ziel")
    room.pending_votes[player.player_id] = target_id
    eligible = [p.player_id for p in room.alive_players()]
    if len(room.pending_votes) >= len(eligible):
        _resolve_day_vote(room)


def _compute_my_turn(room: Room, player: Player):
    step = room.step
    if step == "amor" and player.role == "amor" and player.alive and player.player_id not in room.pending_votes:
        options = [{"playerId": p.player_id, "name": p.name} for p in room.alive_players()]
        return True, {"type": "amor", "multiple": True, "options": options}
    if step == "werwolf" and player.role == "werwolf" and player.alive:
        # Bleibt "dran" (isMyTurn=True), auch nachdem man selbst schon
        # gewählt/bestätigt hat - man sieht weiter die Live-Stimmen der
        # anderen Werwölfe und kann seine eigene Wahl jederzeit ändern,
        # bis wirklich ALLE bestätigt haben.
        options = [{"playerId": p.player_id, "name": p.name} for p in room.alive_players() if p.role != "werwolf"]
        wolf_votes, all_agreed = _wolf_votes_summary(room)
        return True, {
            "type": "werwolf",
            "options": options,
            "wolfVotes": wolf_votes,
            "myVote": room.pending_votes.get(player.player_id),
            "canConfirm": all_agreed,
            "confirmed": player.player_id in room.pending_acks,
        }
    if step == "seherin" and player.role == "seherin" and player.alive:
        options = [{"playerId": p.player_id, "name": p.name} for p in room.alive_players() if p.player_id != player.player_id]
        return True, {"type": "seherin", "options": options}
    if step == "hexe-heal" and player.role == "hexe" and player.alive:
        if room.witch_heal_used or not room.night_victim:
            return False, None
        victim_name = room.players[room.night_victim].name
        return True, {"type": "hexe-heal", "victimName": victim_name}
    if step == "hexe-poison" and player.role == "hexe" and player.alive:
        if room.witch_poison_used:
            return False, None
        options = [{"playerId": p.player_id, "name": p.name} for p in room.alive_players()]
        return True, {"type": "hexe-poison", "options": options, "skipLabel": "Niemand - überspringen"}
    if step == "hunter-shot" and room.pending_hunters and player.player_id == room.pending_hunters[0]:
        options = [{"playerId": p.player_id, "name": p.name} for p in room.alive_players()]
        return True, {"type": "hunter-shot", "options": options}
    if step == "day-discussion" and player.alive and player.player_id not in room.pending_acks:
        return True, {"type": "discussion-ready"}
    if step == "day-vote" and player.alive and player.player_id not in room.pending_votes:
        options = [{"playerId": p.player_id, "name": p.name} for p in room.alive_players()]
        return True, {"type": "day-vote", "options": options, "skipLabel": "Niemand - keine Stimme"}
    return False, None


def _public_status(room: Room) -> str:
    if room.phase == "lobby":
        return "Warten auf den Host …"
    if room.phase == "reveal":
        return f"Alle sehen sich ihre Rolle an … ({len(room.pending_acks)}/{len(room.active_players())} bereit)"
    if room.step == "amor":
        return "Amor wacht auf und verkuppelt zwei Spieler …"
    if room.step == "werwolf":
        return "Alle schlafen ein. Die Werwölfe wählen ihr Opfer …"
    if room.step == "seherin":
        return "Die Seherin schaut sich eine Rolle an …"
    if room.step in ("hexe-heal", "hexe-poison"):
        return "Die Hexe überlegt …"
    if room.step in ("hunter-shot", "day-discussion") or room.phase == "day":
        if not room.last_deaths:
            day_intro = "Es wird Tag. Alle haben überlebt!"
        else:
            names = ", ".join(room.players[pid].name for pid in room.last_deaths if pid in room.players)
            day_intro = f"Es wird Tag. {names} {'ist gestorben' if len(room.last_deaths) == 1 else 'sind gestorben'}."
        if room.step == "hunter-shot" and room.pending_hunters:
            return f"{day_intro} {room.players[room.pending_hunters[0]].name} war der Jäger und darf noch schießen!"
        if room.step == "day-discussion":
            return f"{day_intro} Diskutiert am Tisch, wer verdächtig ist. ({len(room.pending_acks)}/{len(room.alive_players())} bereit zur Abstimmung)"
    if room.step == "day-vote":
        return "Wer soll gehängt werden?"
    if room.phase == "ended":
        return "Das Dorf hat gewonnen!" if room.winner == "dorf" else "Die Werwölfe haben gewonnen!"
    return ""
