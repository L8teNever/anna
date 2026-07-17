# Anna – Partyspiele

## Client-seitige Update-Architektur (Service Worker)

Kurzfassung: **`public/js/version.js`** ist die einzige Stelle mit der
Versionsnummer. Sie wird von `sw.js` per `importScripts()` eingebunden
und bestimmt den Cache-Namen (`anna-cache-<version>`). Erhöhe sie, sobald
sich Design/Spiele/Code/Daten ändern – alles andere läuft automatisch:

1. Browser erkennt einen Byte-Unterschied in `/sw.js` und installiert die
   neue Version im Hintergrund (alter Worker bleibt bis zur Bestätigung aktiv).
2. `public/js/pwa-helper.js` zeigt ein Update-Banner. Der Nutzer muss aktiv
   auf "Aktualisieren" tippen – es gibt **keinen** automatischen Wechsel
   mitten in einer laufenden Spielrunde.
3. Nach Bestätigung schickt die Seite `SKIP_WAITING` an den neuen Worker,
   der aktiviert danach und meldet sich per `SW_ACTIVATED` zurück – die
   Seite lädt einmal sauber neu.
4. **Sicherheitsnetz:** Kommt `SW_ACTIVATED` innerhalb von 5 Sekunden nach
   Klick auf "Aktualisieren" nicht an (z.B. weil der Handshake aus
   irgendeinem Grund hängen bleibt), löscht `forceFreshReload()` in
   `pwa-helper.js` **alle** Caches und meldet **alle**
   Service-Worker-Registrierungen ab, bevor neu geladen wird. "Aktualisieren"
   führt dadurch garantiert zu einem echten frischen Stand – nie zu einem
   Reload derselben feststeckenden alten Version.
5. Zusätzlich prüft die Seite **sofort bei jedem Laden** aktiv auf Updates
   (nicht erst bei einem Sichtbarkeits-Wechsel oder nach 20 Minuten) – siehe
   Kommentare in `pwa-helper.js`.

Offline-Caching (das eigentliche Vorladen der ganzen App) passiert NUR für
die installierte PWA (Standalone-Fenster), nie für einen normalen
Browser-Tab – Details dazu direkt in den Kommentaren von `sw.js`.

**Wenn ein Gerät trotzdem mal "feststeckt"** (z.B. nach vielen schnellen
Versionswechseln während der Entwicklung): Einstellungen → "Cache löschen"
räumt manuell alles auf (`public/js/cache-tools.js`). Das sollte im
Normalbetrieb aber dank Punkt 4 oben nicht mehr nötig sein.

**Bevor du hier einen echten Bug vermutest:** immer zuerst in einem
privaten/Inkognito-Fenster testen. Das startet komplett ohne alten Cache/
Service Worker. Tritt das Problem dort NICHT auf, liegt es an einem alten,
lokal feststeckenden Zustand auf dem ursprünglichen Testgerät (siehe oben),
nicht am Code oder an Cloudflare.

## Cloudflare Cache-Busting & Updates

Die Anwendung verwendet eine Kombination aus einem Service Worker (für Offline-Fähigkeit) und einem Cloudflare Worker (für dynamisches Cache-Busting bei Updates).

### Wichtig: Der `cf-cache-bust` Meta-Tag

In allen HTML-Dateien der Anwendung muss sich im `<head>`-Bereich folgender Meta-Tag befinden:

```html
<meta name="cf-cache-bust" content="true" />
```

#### Warum muss dieser Tag auf **jeder** Seite vorhanden sein?

1. **Domain-weites Flagging im Cloudflare Worker:**
   Der Cloudflare Worker scannt beim Laden einer Seite nach diesem Tag. Wenn er ihn findet, aktiviert er das Cache-Busting (versionierte Asset-Pfade mit `?cb=...`) für die gesamte Domain. Dieses Flag wird im Worker für **5 Minuten** zwischengespeichert.

2. **Gefahr durch direkte Einstiegspunkte (Bookmarks):**
   Wenn ein Nutzer ein Lesezeichen direkt auf ein Unterspiel setzt (z. B. `https://anna.kulbarts.com/games/bombe/`) oder die Einstellungen öffnet, ohne vorher die Startseite besucht zu haben, und seit dem letzten Besuch mehr als 5 Minuten vergangen sind:
   - Der 5-Minuten-Marker im Worker ist abgelaufen.
   - Der Nutzer ruft direkt die Unterseite auf.
   - Wäre der Meta-Tag *nur* auf der Startseite vorhanden, würde der Worker den Tag beim Laden der Unterseite nicht sehen und das Cache-Busting **nicht** aktivieren.
   - Die App würde alte, veraltete Dateien aus dem CDN-Cache laden und es käme zu Darstellungsfehlern.

3. **Garantierte Ausfallsicherheit:**
   Indem der Tag in **allen** HTML-Dateien (`index.html`, `/settings/index.html`, `/games/*/index.html`, `404.html`) integriert ist, wird der Marker bei jedem Seitenaufruf – egal über welchen Pfad der Nutzer einsteigt – zuverlässig gesetzt und verlängert.

### Cloudflare Worker Injektionen komplett deaktivieren

Die App ist für die Ausführung als eigenständige PWA optimiert und besitzt bereits eigene native UI-Elemente (z.B. flüssige Animationen, eigene "Rechtliches"-Links in der Topbar). 

Um **alle** automatischen Injektionen und Eingriffe des Cloudflare Workers auf dieser Domain **komplett abzuschalten**, muss sich in **ausnahmslos allen HTML-Dateien** im `<head>`-Bereich zusätzlich folgender Meta-Tag befinden:

```html
<meta name="cf-worker-bypass" content="true" />
```

Durch diesen Tag ignoriert der Cloudflare Worker die Seite komplett und injiziert nichts mehr. Dies schaltet folgende Funktionen des Workers ab:
- Kein Ladeanimations-Overlay (wird hier nicht benötigt, da Cache-geladen)
- Kein "Rechtliches"-Button unten links
- Kein Favicon-Fallback-Script
- Keine eigenen 404/403/500/503-Fehlerseiten (Origin-Fehler kommen unverändert durch)
