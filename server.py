"""Anna – statischer Webserver für die Offline-Partyspiele-PWA.

Der Server enthält bewusst KEINE Spiellogik. Er liefert nur Dateien aus
`public/` aus. Alle Spiele laufen komplett clientseitig (siehe public/js/
und public/games/<id>/), damit sie nach dem ersten Laden auch offline
(über den Service Worker) funktionieren.

EINZIGE Ausnahme: der Online-Mehrgeräte-Modus von "Werwolf" braucht echten
Server-Zustand (mehrere Geräte müssen sich eine Runde teilen). Diese Logik
lebt komplett separat in `werwolf_backend.py` - der Server hier delegiert
nur `/api/werwolf/...`-Anfragen dorthin, alles andere bleibt unverändert
reines Datei-Ausliefern.

Routing-Konvention (macht neue Spiele "plug and play"):
  /                     -> public/index.html
  /settings             -> public/settings/index.html
  /<game-id>            -> public/games/<game-id>/index.html   (falls vorhanden)
  /api/werwolf/...      -> werwolf_backend.py (JSON-POST + SSE-Stream)
  /alles-andere         -> public/<pfad> als statische Datei

Ein neues Spiel hinzufügen = neuen Ordner unter public/games/<id>/ mit
einer index.html anlegen. Der Server erkennt die Route automatisch.
"""

from __future__ import annotations

import json
import mimetypes
import os
import time
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

import werwolf_backend

PUBLIC_DIR = Path(__file__).resolve().parent / "public"
GAMES_DIR = PUBLIC_DIR / "games"
PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "0.0.0.0")

# Dateien, die nie von einem HTTP-Cache gehalten werden dürfen, damit der
# Update-Banner-Mechanismus (siehe public/js/pwa-helper.js) zuverlässig neue
# Versionen erkennt.
NO_CACHE_FILENAMES = {"index.html", "sw.js", "manifest.json"}

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/webp", ".webp")

# Einfaches In-Memory-Rate-Limiting pro IP für ALLE /api/-GET-Endpunkte
# (banners, reveal-avatars, und automatisch auch künftige) - dieselbe
# Sliding-Window-Idee wie in werwolf_backend.py, hier nur global statt pro
# Raum. Bewusst rein im Arbeitsspeicher (keine Datei/Datenbank).
_RATE_BUCKETS: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 10.0
RATE_LIMIT_MAX_REQUESTS = 30


def _rate_limited(client_ip: str) -> bool:
    now = time.time()
    bucket = _RATE_BUCKETS.setdefault(client_ip, [])
    bucket[:] = [t for t in bucket if now - t < RATE_LIMIT_WINDOW]
    if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
        return True
    bucket.append(now)
    return False


def get_banners_list() -> dict[str, str]:
    """Spiel-Banner werden nicht mehr über ein Admin-Dashboard hochgeladen,
    sondern lokal ins Repo gelegt (public/assets/banners/<gameId>.<ext>) und
    normal per Git committed. Diese Funktion liest nur, was dort liegt."""
    banners = {}
    banners_dir = PUBLIC_DIR / "assets" / "banners"
    if banners_dir.is_dir():
        for f in os.listdir(banners_dir):
            name, ext = os.path.splitext(f)
            if ext.lower() in (".png", ".webp", ".jpg", ".jpeg"):
                banners[name] = f"/assets/banners/{f}"
    return banners


def get_banners_config() -> dict[str, dict[str, any]]:
    """Position/Zoom/Sichtbarkeits-Einstellungen pro Banner - liegt als
    normale, von Hand gepflegte JSON-Datei neben den Bildern."""
    config_file = PUBLIC_DIR / "assets" / "banners" / "config.json"
    if config_file.is_file():
        try:
            return json.loads(config_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def resolve_route(raw_path: str) -> str | None:
    """Bildet eine sauber Route (z.B. '/bombe/kategorien') auf einen Dateipfad relativ
    zu PUBLIC_DIR ab. Gibt None zurück, wenn die Anfrage als normaler
    Static-File-Request behandelt werden soll."""

    path = unquote(raw_path).strip("/")

    if path == "":
        return "index.html"

    if path == "settings":
        return "settings/index.html"

    if path == "rechtliches":
        return "rechtliches/index.html"

    # Bereits vorhandene Dateien (css/js/json/png/...) unverändert lassen.
    if "." in path.rsplit("/", 1)[-1]:
        return None

    # Game-Routing: /bombe  ODER  /bombe/kategorien → games/bombe/index.html
    # Nur das erste Pfad-Segment bestimmt das Spiel; Unter-Segmente wie
    # /kategorien, /spieler, /spiel werden clientseitig via history.pushState
    # aufgelöst (view-nav.js).
    game_id = path.split("/")[0]
    game_index = GAMES_DIR / game_id / "index.html"
    if game_index.is_file():
        return f"games/{game_id}/index.html"

    return None


class AnnaRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def send_head(self):
        # Clean-URL-Routing vor der Standard-Dateiauflösung anwenden.
        split = urlsplit(self.path)
        route = resolve_route(split.path)
        if route is not None:
            self.path = "/" + route + (f"?{split.query}" if split.query else "")
        return super().send_head()

    def end_headers(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            # API-Antworten (JSON + SSE) dürfen nie zwischengespeichert
            # werden - enthalten Session-/Rollen-Zustand.
            self.send_header("Cache-Control", "no-store")
        else:
            filename = Path(path).name
            suffix = Path(path).suffix.lower()
            if filename in NO_CACHE_FILENAMES or filename == "" or suffix in (".js", ".css"):
                self.send_header("Cache-Control", "no-cache, must-revalidate")
            else:
                self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/") and _rate_limited(self.client_address[0]):
            self._send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Zu viele Anfragen - bitte kurz warten"})
            return
        if path == "/api/banners":
            self._send_json(HTTPStatus.OK, {
                "banners": get_banners_list(),
                "config": get_banners_config()
            })
            return

        if path == "/api/reveal-avatars":
            try:
                import image_processor
                image_processor.process_import_folder()
            except Exception as e:
                print(f"[anna] Error processing import: {e}")

            avatars = []
            try:
                processed_dir = PUBLIC_DIR / "assets" / "reveal_images"
                if processed_dir.is_dir():
                    for f in sorted(os.listdir(processed_dir)):
                        if f.lower().endswith((".png", ".webp")):
                            avatars.append(f"/assets/reveal_images/{f}")
            except Exception as e:
                print(f"[anna] Error listing avatars: {e}")

            if not avatars:
                avatars = [
                    "/assets/reveal_images/avatar_1.png",
                    "/assets/reveal_images/avatar_2.png",
                    "/assets/reveal_images/avatar_3.png",
                    "/assets/reveal_images/avatar_4.png"
                ]

            self._send_json(HTTPStatus.OK, avatars)
            return

        segments = [p for p in path.strip("/").split("/") if p]
        if len(segments) == 5 and segments[:3] == ["api", "werwolf", "rooms"] and segments[4] == "stream":
            self._handle_werwolf_stream(segments[3])
            return
        super().do_GET()

    def do_POST(self):
        segments = [p for p in urlsplit(self.path).path.strip("/").split("/") if p]
        if len(segments) >= 2 and segments[0] == "api" and segments[1] == "werwolf":
            self._handle_werwolf_post(segments[2:])
            return
        self.send_error(HTTPStatus.NOT_IMPLEMENTED, f"Unsupported method ({self.command!r})")

    def _handle_werwolf_post(self, segments: list[str]) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
            if not isinstance(body, dict):
                raise ValueError("body must be a JSON object")
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Ungültiges JSON"})
            return

        try:
            result = werwolf_backend.handle_post(segments, body, self.client_address[0])
            self._send_json(HTTPStatus.OK, result)
        except werwolf_backend.ApiError as exc:
            # Bewusst OHNE den Request-Body im Log: der kann Spielernamen
            # enthalten (hostName/name-Felder) - DSGVO-Datensparsamkeit,
            # keine personenbezogenen Daten in Server-Logs.
            print(f"[anna][werwolf] {exc.status} '{exc.message}' for /{'/'.join(segments)}")
            self._send_json(exc.status, {"error": exc.message})

    def _handle_werwolf_stream(self, token: str) -> None:
        query = parse_qs(urlsplit(self.path).query)
        player_token = (query.get("playerToken") or [""])[0]
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            werwolf_backend.stream_room(token, player_token, self.wfile)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def _send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_error(self, code, message=None, explain=None):
        if code == HTTPStatus.NOT_FOUND:
            not_found = PUBLIC_DIR / "404.html"
            if not_found.is_file():
                self.send_response(HTTPStatus.NOT_FOUND)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                body = not_found.read_bytes()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        # Bewusst OHNE Client-IP (self.address_string()) - DSGVO-
        # Datensparsamkeit: der Server soll keine personenbezogenen Daten
        # in seinen eigenen Logs halten. Anfrage selbst (Methode/Pfad/
        # Status) bleibt fürs Debugging sichtbar.
        print(f"[anna] {format % args}")


def main() -> None:
    try:
        import image_processor
        image_processor.process_import_folder()
    except Exception as e:
        print(f"[anna] Error on startup import processing: {e}")

    server = ThreadingHTTPServer((HOST, PORT), AnnaRequestHandler)
    print(f"[anna] serving {PUBLIC_DIR} on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
