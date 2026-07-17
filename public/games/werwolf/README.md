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

Noch nicht enthalten – geplant als zweiter Ausbauschritt mit eigenem
Backend (Server-Sent Events + Raum-Token), siehe Projektplan. Aktuell ist
nur der Einzelgerät-Modus implementiert.
