# Anna – Partyspiele

Eine selbst gehostete Sammlung browserbasierter Partyspiele als Progressive
Web App (PWA). Läuft nach dem ersten Laden komplett offline, ohne
Benutzerkonten, ohne Werbung und ohne Tracking – Details dazu in der
[Datenschutzerklärung](public/rechtliches/index.html).

## Spiele

| Spiel | Kurzbeschreibung |
|---|---|
| Tickende Bombe | Begriff aus der aktiven Kategorie nennen, bevor die Bombe hochgeht |
| Impostor | Alle außer dem Impostor kennen das Geheimwort |
| Ich hab noch nie | Klassisches "Ich hab noch nie …"-Trinkspiel |
| Wer würde eher | Alle zeigen gleichzeitig auf die passende Person |
| Wer bin ich? | Eigene Identität per Ja/Nein-Fragen erraten |
| Perfekte Form | Form freihand nachzeichnen, Prozentzahl entscheidet |
| Werwolf | Einzelgerät **oder** echter Online-Mehrspieler-Modus – [eigenes README](public/games/werwolf/README.md) |

Jedes Spiel liegt unter `public/games/<id>/`, meist mit eigener
`categories.json` (Wörter/Fragen/Prompts) und teils einem eigenen README mit
Details zur jeweiligen Spiellogik.

## Tech-Stack

- **Backend**: Python-Standardbibliothek (`http.server` /
  `ThreadingHTTPServer`) – kein Framework, keine Datenbank. Einzige externe
  Abhängigkeit ist Pillow (`image_processor.py`, für die
  "Wer bin ich?"-Avatarverarbeitung).
- **Frontend**: Vanilla JavaScript ohne Build-Schritt, Bundler oder
  Framework.
- Jedes Spiel ist bewusst ein eigenständiges HTML-Dokument statt einer
  Single-Page-App – so kann jedes Spiel unabhängig fürs Offline-Spielen
  vorgecacht werden (siehe `public/sw.js`). Ein eigenes clientseitiges
  Routing (`public/js/router.js`) sorgt trotzdem für flüssige Übergänge ohne
  echte Seiten-Reloads.
- **Persistenz**: ausschließlich `localStorage` im Browser (Spielerliste,
  Favoriten, Einstellungen) – verlässt nie das Gerät. Einzige Ausnahme: Der
  Werwolf-Online-Modus hält den laufenden Rundenstand kurzzeitig im
  Server-Arbeitsspeicher (siehe `werwolf_backend.py`), nie auf Platte.

## Lokal starten

```bash
python server.py
```

Läuft danach auf `http://localhost:8080` (Port über die Umgebungsvariable
`PORT`, Host über `HOST` änderbar).

## Projektstruktur

```
server.py                  Statischer Webserver + Routing zu werwolf_backend.py
werwolf_backend.py          Werwolf-Online-Backend (einziges Spiel mit Server-Logik)
image_processor.py          Avatar-Bildverarbeitung für "Wer bin ich?"
public/
  index.html                 Startseite
  settings/                  Einstellungsseite
  rechtliches/                Impressum & Datenschutzerklärung
  games/<id>/                  Ein Ordner pro Spiel (index.html, <id>.js, <id>.css, categories.json)
  js/                          Gemeinsame Module (Router, Storage, Picker, ...)
  css/                          Gemeinsames Material-3-Design-System
  sw.js                        Service Worker (Offline-Caching, Update-Erkennung)
```

## Neues Spiel hinzufügen

1. Neuen Ordner `public/games/<id>/` mit einer `index.html` anlegen – die
   Route `/<id>` wird von `server.py` automatisch erkannt.
2. Eintrag in `public/js/game-registry.js` (`GAMES`-Array) ergänzen –
   einzige Stelle, die für Startseite, Suche und Offline-Cache angepasst
   werden muss.
3. Bei Wort-/Fragen-Kategorien: eigene `categories.json`, geladen über
   `CategoryPicker.create(...)` (siehe `public/js/category-picker.js`).
4. `APP_VERSION` in `public/js/version.js` **und** `public/sw.js`
   hochzählen (siehe unten, warum beide Stellen nötig sind).

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE) – frei nutzbar,
veränderbar und weiterverbreitbar, auch kommerziell, solange der
Lizenz-/Copyright-Hinweis erhalten bleibt.

## Client-seitige Update-Architektur (Service Worker)

Kurzfassung: Die Versionsnummer steht an **zwei** Stellen, die **beide**
bei jeder Änderung hochgezählt werden müssen:

- **`public/js/version.js`** – wird auf normalen Seiten eingebunden und in
  den Einstellungen angezeigt (`window.APP_VERSION`).
- **`public/sw.js`** (die Konstante `APP_VERSION` direkt am Dateianfang,
  nach den einleitenden Kommentaren) – bestimmt den Cache-Namen
  (`anna-cache-<version>`).

**Warum nicht nur eine Stelle?** Der Browser erkennt ein Update
ausschließlich über einen Byte-Unterschied in `sw.js` selbst – Dateien,
die per `importScripts()` nachgeladen werden (das wäre `version.js`),
zählen dafür NICHT mit. Stünde die Versionsnummer nur in `version.js`,
könnte man sie beliebig oft hochzählen, ohne dass der Browser jemals ein
Update erkennt: `sw.js` sähe für ihn immer gleich aus, installierte PWAs
blieben für immer auf dem alten Stand hängen (das war tatsächlich lange
Zeit ein aktiver, unbemerkter Bug hier). Deshalb steht die Zahl jetzt
redundant in `sw.js` selbst – erhöhe **beide** Stellen gemeinsam, sobald
sich Design/Spiele/Code/Daten ändern (auch wenn nur eine importierte Datei
wie `game-registry.js` sich geändert hat!). Alles andere läuft automatisch:

1. Browser erkennt einen Byte-Unterschied in `/sw.js` und installiert die
   neue Version im Hintergrund (alter Worker bleibt bis zur Bestätigung aktiv).
2. `public/js/pwa-helper.js` zeigt ein Update-Popup. Der Nutzer muss aktiv
   auf "Aktualisieren" tippen – es gibt **keinen** automatischen Wechsel
   mitten in einer laufenden Spielrunde.
3. Nach Bestätigung schickt die Seite `SKIP_WAITING` an den neuen Worker,
   der aktiviert danach und meldet sich per `SW_ACTIVATED` zurück – die
   Seite lädt einmal sauber neu.
4. **Sicherheitsnetz:** Kommt `SW_ACTIVATED` innerhalb von 5 Sekunden nach
   Klick auf "Aktualisieren" nicht an (z.B. weil der Handshake aus
   irgendeinem Grund hängen bleibt), löscht `forceFreshReload()` in
   `pwa-helper.js` alle **versionierten** Caches (`anna-cache-*`) und meldet
   **alle** Service-Worker-Registrierungen ab, bevor neu geladen wird. Der
   dauerhafte Flag-Cache (siehe unten) bleibt dabei bewusst erhalten – ein
   holpriges Update soll ein Gerät nicht fälschlich wie eine brandneue
   Installation behandeln. "Aktualisieren" führt dadurch garantiert zu einem
   echten frischen Stand – nie zu einem Reload derselben feststeckenden
   alten Version.
5. Zusätzlich prüft die Seite **sofort bei jedem Laden** aktiv auf Updates
   (nicht erst bei einem Sichtbarkeits-Wechsel oder nach 20 Minuten) – siehe
   Kommentare in `pwa-helper.js`.

(Ein früherer Versuch, hier zusätzlich einen zweiten, vom Service-Worker
unabhängigen Versionsabgleich per Roh-Fetch von `version.js` einzubauen,
wurde wieder entfernt: er hat durch CDN-/Cache-Eigenheiten gelegentlich
einen falschen Unterschied gemeldet und dadurch das Update-Popup in einer
Schleife erneut angezeigt. Da Punkt 1 oben (Byte-Diff direkt in `sw.js`)
die eigentliche Ursache bereits zuverlässig löst, war der Zusatz-Check
unnötiges Risiko ohne echten Zusatznutzen.)

Offline-Caching (das eigentliche Vorladen der ganzen App) passiert NUR für
die installierte PWA (Standalone-Fenster), nie für einen normalen
Browser-Tab – Details dazu direkt in den Kommentaren von `sw.js`.

**Wenn ein Gerät trotzdem mal "feststeckt"** (z.B. nach vielen schnellen
Versionswechseln während der Entwicklung): Einstellungen → "Cache löschen"
räumt manuell alles auf (`public/js/cache-tools.js`). Das sollte im
Normalbetrieb aber dank Punkt 4 oben nicht mehr nötig sein.

**Wichtig: Die installierte PWA "neu installieren" (Icon entfernen und neu
hinzufügen) räumt NICHTS auf!** Service-Worker-Registrierung und Cache
Storage gehören zum *Browser-Profil/Origin*, nicht zum App-Icon. Ent- und
Wiederinstallieren entfernt nur die Verknüpfung, die zugrunde liegenden
(evtl. veralteten) Daten bleiben exakt gleich bestehen. Der einzige Weg,
wirklich alles zurückzusetzen, ist "Cache löschen" in den Einstellungen –
und das funktioniert von **jedem** Fenster aus (normaler Tab reicht),
weil beide sich dieselbe Origin-Speicherung teilen.

**Bevor du hier einen echten Bug vermutest:** immer zuerst in einem
privaten/Inkognito-Fenster testen. Das startet komplett ohne alten Cache/
Service Worker. Tritt das Problem dort NICHT auf, liegt es an einem alten,
lokal feststeckenden Zustand auf dem ursprünglichen Testgerät (siehe oben),
nicht am Code selbst.
