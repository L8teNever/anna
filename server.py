"""Anna – statischer Webserver für die Offline-Partyspiele-PWA.

Der Server enthält bewusst KEINE Spiellogik. Er liefert nur Dateien aus
`public/` aus. Alle Spiele laufen komplett clientseitig (siehe public/js/
und public/games/<id>/), damit sie nach dem ersten Laden auch offline
(über den Service Worker) funktionieren.

Routing-Konvention (macht neue Spiele "plug and play"):
  /                -> public/index.html
  /settings        -> public/settings/index.html
  /<game-id>       -> public/games/<game-id>/index.html   (falls vorhanden)
  /alles-andere    -> public/<pfad> als statische Datei

Ein neues Spiel hinzufügen = neuen Ordner unter public/games/<id>/ mit
einer index.html anlegen. Der Server erkennt die Route automatisch.
"""

from __future__ import annotations

import mimetypes
import os
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit

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


def resolve_route(raw_path: str) -> str | None:
    """Bildet eine sauber Route (z.B. '/bombe') auf einen Dateipfad relativ
    zu PUBLIC_DIR ab. Gibt None zurück, wenn die Anfrage als normaler
    Static-File-Request behandelt werden soll."""

    path = unquote(raw_path).strip("/")

    if path == "":
        return "index.html"

    if path == "settings":
        return "settings/index.html"

    # Bereits vorhandene Dateien (css/js/json/png/...) unverändert lassen.
    if "." in path.rsplit("/", 1)[-1]:
        return None

    game_index = GAMES_DIR / path / "index.html"
    if game_index.is_file():
        return f"games/{path}/index.html"

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
        filename = Path(urlsplit(self.path).path).name
        if filename in NO_CACHE_FILENAMES or filename == "":
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

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
        print(f"[anna] {self.address_string()} - {format % args}")


def main() -> None:
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
