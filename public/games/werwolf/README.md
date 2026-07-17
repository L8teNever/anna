# Werwolf

Anders als Bombe/Impostor/Ich hab noch nie/Wer bin ich gibt es hier **keine**
`categories.json` – Werwolf hat keine Wort-Kategorien, sondern feste Rollen
mit konfigurierbarer Anzahl. Die Rollen-Definitionen (Namen, Beschreibungen)
stehen direkt in [`werwolf.js`](werwolf.js) in den Objekten `ROLE_LABELS` und
`ROLE_DESCRIPTIONS` – wer eine Rolle umbenennen oder ihren Beschreibungstext
ändern möchte, passt diese beiden Stellen an.

## Rollen (Einzelgerät-Modus, aktueller Stand)

| Rolle | Konfiguration | Kurzbeschreibung |
|---|---|---|
| Werwolf | Stepper, min. 1 | wählt nachts gemeinsam mit den anderen Werwölfen ein Opfer |
| Dorfbewohner | füllt automatisch den Rest auf | keine Fähigkeit |
| Seherin | an/aus | sieht nachts die Rolle einer Person |
| Hexe | an/aus | einmaliger Heiltrank + einmaliger Gifttrank |
| Amor | an/aus | nur Runde 1: verkuppelt zwei Spieler (Liebes-Kettentod) |
| Jäger | an/aus | darf beim Sterben sofort noch jemanden erschießen |

Die maximale Werwolf-Anzahl richtet sich nach der Mitspieler-Zahl
(`maxWerewolvesFor()` in `werwolf.js` – ca. ein Drittel der Spieler, gedeckelt
bei 6), damit die Werwölfe nie versehentlich in der Überzahl starten.

## Ablauf

Reine Zustandsmaschine in `werwolf.js` (`goToStep`/`renderStep`):
`lobby → Rollen-Wisch-Karte (eigene Rolle, danach nur die Werwölfe
untereinander) → Nacht (Amor nur Runde 1 → Werwölfe → Seherin → Hexe) → Tag
(Ergebnis → Jäger-Schuss falls nötig → Diskussion → Abstimmung) → nächste
Nacht (Runde+1) → Ende`, sobald alle Werwölfe tot sind oder die Werwölfe in
der Überzahl sind.

Alle Nacht-/Tag-Eingaben (wer wird gewählt, gerettet, vergiftet, gehängt …)
passieren auf demselben einen Gerät – genau wie bei allen anderen Spielen
dieser App geht das Handy einfach an die jeweils gemeinte Person, es gibt
keinen technischen Schutz davor, dass andere mitschauen (Vertrauen wie am
echten Spieltisch).

## Neue Rolle hinzufügen

1. In `werwolf.js`: Eintrag in `ROLE_LABELS` + `ROLE_DESCRIPTIONS`.
2. In `buildRoles()`: `if (roleConfig.<neueRolle>) bag.push("<neueRolle>");`
   ergänzen.
3. Falls die Rolle eine eigene Nacht-Aktion braucht: einen neuen `case` in
   `renderStep()` plus die passende Verkettung in `afterWerwolf()`/
   `afterSeherin()`/etc. ergänzen.
4. Falls konfigurierbar: Toggle/Stepper in `index.html` (`game-options-card`)
   + Laden/Speichern in `loadRoleConfig()` ergänzen.

## Online-Mehrgeräte-Modus

Zweiter Spielmodus (Segmented-Control oben im Setup): jede Person joint mit
ihrem EIGENEN Gerät über QR-Code/Link, sieht ihre Rolle privat auf ihrem
eigenen Screen und macht Nacht-Aktionen (Werwolf-Opfer, Seherin, Hexe, Amor)
auf ihrem eigenen Gerät statt am gemeinsam herumgereichten Handy.

**Einziges Spiel dieser App mit echter Server-Spiellogik** – die komplette
Backend-Logik (Räume, Rollen-Zustandsmaschine, Abstimmungen) lebt in
[`werwolf_backend.py`](../../../werwolf_backend.py) im Projekt-Root, rein im
Arbeitsspeicher (kein Datenbank, keine neue Abhängigkeit). `server.py`
delegiert nur `/api/werwolf/...`-Anfragen dorthin – alle anderen Spiele
bleiben unverändert rein clientseitig.

- **Architektur**: Server-Sent Events (Server→Client, 1×/Sekunde gepollt,
  siehe `STREAM_POLL_INTERVAL`) + normale POST-JSON-Endpunkte
  (Client→Server). Kein WebSocket, keine neue pip-Abhängigkeit, ein Prozess.
- **Sicherheit**: Raum-/Spieler-Token sind 128-Bit-Zufallswerte
  (`secrets.token_urlsafe`), es gibt keinen Endpunkt, der Räume auflistet –
  nur wer den exakten Link/QR-Code hat, kann beitreten. Beitritt geht nur,
  solange die Runde noch in der Lobby ist. Rate-Limiting pro IP auf
  join/action-Endpunkten.
- **Datensparsamkeit (DSGVO)**: alles nur im Arbeitsspeicher, kein Logging
  von Namen/Rollen auf Platte, Räume verfallen nach 6h Inaktivität
  (`ROOM_TTL_SECONDS`) oder wenn der Host beendet. **Kein Ersatz für eine
  rechtliche Prüfung** – falls diese App über den Freundeskreis hinaus
  genutzt wird, gehört eine entsprechende Ergänzung auf die externe
  `legal.kulbarts.com`-Seite dazu, da hier zum ersten Mal Namen über einen
  Server laufen (wenn auch nur temporär und im Arbeitsspeicher).
- **Reconnect**: der Client speichert `{playerToken}` pro Raum in
  `localStorage` (`anna:werwolf:session:<roomToken>`) – Handy aus/an oder
  Tab neu laden wirft niemanden raus, solange der Raum noch existiert.
- **QR-Code**: rein clientseitig erzeugt (vendored `public/js/qrcode.js`,
  MIT-lizenzierter Encoder von Kazuhiko Arase) – die Einladungs-URL wird
  NIE an einen externen QR-Bild-Dienst geschickt.
- **Bildschirm-Verhalten**: `WakeLock.enable()` hält alle verbundenen
  Bildschirme an, solange die Runde läuft. Außerhalb der eigenen Aktion
  zeigt jedes Gerät denselben neutralen `publicStatus`-Text – nur das Gerät
  der Person, die gerade dran ist, zeigt kurz die private Auswahl
  (`isMyTurn`/`myAction` im Snapshot). So kann man die Handys offen auf den
  Tisch legen, ohne dass ein Blick verrät, wer welche Rolle hat.
