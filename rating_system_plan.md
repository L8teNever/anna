# Technischer Umsetzungsplan: Öffentliches Wort-Feedback

Dieser Plan beschreibt die Architektur für ein **sicheres, spam-geschütztes und spielübergreifendes** Bewertungssystem für deine Spiele-Plattform. Da der Code nicht direkt verändert werden soll, dient dies als genaue Anleitung.

---

## 🛡️ 1. DSGVO-konformer Anti-Spam-Schutz (ohne IP-Speicherung)

In Deutschland/EU sind IP-Adressen personenbezogene Daten. Um das System **100% DSGVO-konform** zu halten, dürfen wir die IP-Adressen nicht im Klartext speichern.

### Die Lösung: Anonymisiertes IP-Hashing (One-Way)
* Wir fangen die IP des Spielers ab, hängen ein geheimes Zufallssortiment (Salt) an und **hashen** das Ganze sofort mittels SHA-256.
* Aus der IP `192.168.1.42` wird so ein anonymer Textsalat (z.B. `8f4b1e...`).
* Der Server speichert für das Rate-Limiting **nur diesen Hash** im RAM.
* Da der Salt beim Serverstart zufällig generiert wird und nur im Arbeitsspeicher liegt, ist es mathematisch unmöglich, aus dem Hash jemals wieder die echte IP-Adresse zu rekonstruieren.
* Die IP-Adresse wird somit **niemals auf der Festplatte gespeichert** und ist im RAM vollständig anonymisiert.

### Python-Code für `server.py` (DSGVO-sicheres Rate-Limiting):
```python
import time
import secrets
import hashlib
from collections import defaultdict

# Einmaliger Zufalls-Schlüssel beim Serverstart zur Anonymisierung der IPs
# Macht es unmöglich, die originalen IPs aus den Hashes zu errechnen.
SERVER_SALT = secrets.token_hex(32)

# In-Memory Speicher für Rate-Limits (Anonymer Hash -> Liste von Timestamps)
ip_vote_history = defaultdict(list)
RATE_LIMIT_VOTES = 10
RATE_LIMIT_WINDOW = 60

# 2. Server-seitige Zeitmessung (Session-ID -> Start-Timestamp)
active_game_sessions = {}

def get_anonymous_ip_hash(ip: str) -> str:
    """Wandelt die IP-Adresse in einen völlig anonymen Hash um."""
    hasher = hashlib.sha256()
    # IP mit dem Server-Salt kombinieren und hashen
    hasher.update(f"{ip}:{SERVER_SALT}".encode("utf-8"))
    return hasher.hexdigest()

def is_rate_limited(ip: str) -> bool:
    now = time.time()
    ip_hash = get_anonymous_ip_hash(ip)
    
    # Entferne alte Timestamps außerhalb des Zeitfensters
    ip_vote_history[ip_hash] = [t for t in ip_vote_history[ip_hash] if now - t < RATE_LIMIT_WINDOW]
    
    if len(ip_vote_history[ip_hash]) >= RATE_LIMIT_VOTES:
        return True
        
    ip_vote_history[ip_hash].append(now)
    return False

def clean_expired_sessions():
    """Bereinigt alte verwaiste Sessions im RAM (älter als 2 Stunden)"""
    now = time.time()
    expired = [sid for sid, start_time in active_game_sessions.items() if now - start_time > 7200]
    for sid in expired:
        active_game_sessions.pop(sid, None)
```

### Die zwei API-Routen im Backend:

#### Route A: `POST /api/ratings/start`
Wird beim Spielstart aufgerufen. Der Server generiert ein sicheres Session-Token und speichert die aktuelle Zeit.
```python
if len(segments) >= 3 and segments[0] == "api" and segments[1] == "ratings" and segments[2] == "start":
    clean_expired_sessions()
    
    # Generiere ein zufälliges Session-Token
    session_token = secrets.token_hex(16)
    active_game_sessions[session_token] = time.time()
    
    self._send_json(HTTPStatus.OK, {"sessionToken": session_token})
    return
```

#### Route B: `POST /api/ratings/vote`
Wird am Spielende aufgerufen. Der Server prüft die Dauer und löscht danach die Session.
```python
if len(segments) >= 3 and segments[0] == "api" and segments[1] == "ratings" and segments[2] == "vote":
    ip = self.client_address[0]
    if is_rate_limited(ip):
        self._send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Zu viele Anfragen."})
        return

    length = int(self.headers.get("Content-Length") or 0)
    raw = self.rfile.read(length) if length else b""
    try:
        body = json.loads(raw.decode("utf-8"))
        session_token = body.get("sessionToken")
        game_id = body.get("gameId")
        category = body.get("category")
        word = body.get("word")
        rating_type = body.get("rating")
    except Exception:
        self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Ungültiges JSON"})
        return

    # Prüfen, ob die Session existiert
    if not session_token or session_token not in active_game_sessions:
        self._send_json(HTTPStatus.FORBIDDEN, {"error": "Ungültige oder abgelaufene Spielsitzung."})
        return

    # Zeitdifferenz berechnen
    start_time = active_game_sessions[session_token]
    duration = time.time() - start_time

    # Session sofort ungültig machen, um Replay-Angriffe zu verhindern
    del active_game_sessions[session_token]

    # Validierung: Spielrunde muss mindestens 25 Sekunden gedauert haben
    if duration < 25.0:
        self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Spielzeit zu kurz für eine Bewertung."})
        return

    # Validierung der Abstimmung & Speichern in ratings.json
    if game_id and category and word and rating_type in ("good", "bad"):
        # Speichern...
        self._send_json(HTTPStatus.OK, {"success": True})
    else:
        self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Fehlende Parameter"})
    return
```

---

## 🎮 2. Frontend-Ablauf & Online-Pflicht

Damit das Voting **nur online** funktioniert und **nur nach einem vollständig beendeten Spiel** möglich ist, implementieren wir folgende Logik:

### 1. Online-Status prüfen
Wir nutzen `navigator.onLine`. Ist das Gerät offline, fordern wir keine Session an und blenden die Voting-Buttons gar nicht erst ein.

### 2. Ablauf im Spiel-Code (z.B. Impostor, Bombe, Werwolf):

```javascript
let currentSessionToken = null;

// HIER: Wird aufgerufen, wenn das Spiel TATSÄCHLICH startet
async function startNewGameSession() {
    // Nur anfragen, wenn das Gerät online ist
    if (!navigator.onLine) {
        currentSessionToken = null;
        return;
    }

    try {
        const res = await fetch('/api/ratings/start', { method: 'POST' });
        const data = await res.json();
        currentSessionToken = data.sessionToken;
    } catch (err) {
        currentSessionToken = null;
    }
}

// HIER: Wird aufgerufen, wenn der letzte Spielbildschirm (Game Over / Ergebnis) erreicht wird
function showGameEndScreen(playedWords) {
    const votingContainer = document.getElementById("voting-container");
    if (!votingContainer) return;

    // Nur anzeigen, wenn wir online sind UND eine gültige Session gestartet wurde
    if (navigator.onLine && currentSessionToken) {
        votingContainer.innerHTML = "<h3>Wie fandest du die Wörter dieser Runde?</h3>";
        
        playedWords.forEach(wordObj => {
            const row = document.createElement("div");
            row.className = "voting-row";
            row.innerHTML = `
                <span>${wordObj.word}</span>
                <button onclick="submitVote('${wordObj.category}', '${wordObj.word}', 'good')">👍</button>
                <button onclick="submitVote('${wordObj.category}', '${wordObj.word}', 'bad')">👎</button>
            `;
            votingContainer.appendChild(row);
        });
    } else {
        // Falls offline oder kein Token vorhanden (weil das Spiel abgebrochen wurde)
        votingContainer.innerHTML = "<p style='opacity: 0.5'>Bewertung nur bei aktiver Onlineverbindung und nach beendeter Runde möglich.</p>";
    }
}

function submitVote(category, word, rating) {
    if (!currentSessionToken) return;

    fetch('/api/ratings/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionToken: currentSessionToken,
            gameId: 'impostor', // Hier dynamisch je nach Spiel anpassen
            category: category,
            word: word,
            rating: rating
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // UI-Feedback (z.B. Buttons ausgrauen)
        }
    });
}
```

---

## 📊 3. Spielübergreifende Statistik-Seite (`public/settings/ratings.html`)

*(Die UI-Struktur mit Tabs zur Filterung und automatischem Abgleich mit `categories.json` bleibt identisch zu den vorherigen Entwürfen.)*
