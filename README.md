# Anna – Partyspiele

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
