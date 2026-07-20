# Kategorien für „Ich hab noch nie“

Genau wie bei „Tickende Bombe“ und „Impostor“ stehen alle Kategorien und
Aussagen in einer reinen Daten-Datei: [`categories.json`](categories.json)
in diesem Ordner. Kein Code-Wissen nötig – die App liest die Datei beim
Start ein und zeigt automatisch an, was darin steht.

## Eigene Kategorien direkt in der App erstellen

Für den schnellen Weg ohne Datei-Bearbeitung: In der Kategorie-Auswahl im
Spiel selbst gibt es ganz unten den Button „Eigene Kategorie erstellen“.
Damit angelegte Kategorien landen NICHT in `categories.json`, sondern separat
im Browser-Speicher (localStorage) des Geräts – sie bleiben dort dauerhaft
erhalten, auch nach einem App-Update über den „Aktualisieren“-Button oder
„Cache löschen“ (beides betrifft nur den Datei-Cache, nie den lokalen
Speicher). Eigene Kategorien lassen sich in der Auswahl über die Stift- bzw.
X-Buttons direkt an der jeweiligen Zeile bearbeiten oder löschen.

Der Rest dieser Anleitung bezieht sich auf den anderen Weg: Kategorien fest
in `categories.json` eintragen, z.B. wenn sie für alle Geräte gleich
vorinstalliert sein sollen.

## Aufbau der Datei

```json
[
  {
    "id": "klassiker",
    "label": "Klassiker",
    "icon": "🎉",
    "words": ["im Unterricht eingeschlafen", "eine Notlüge erzählt"]
  }
]
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Interner, eindeutiger Name. Nur Kleinbuchstaben, keine Leerzeichen/Umlaute/Sonderzeichen. Bei einer bestehenden Kategorie **nicht mehr ändern**, sonst vergisst die App die gespeicherte Auswahl. |
| `label` | ja | Angezeigter Name der Kategorie. |
| `icon` | ja | Ein Emoji vor dem Namen. |
| `words` | ja | Die eigentlichen Aussagen dieser Kategorie – **wichtig:** jeder Eintrag ist nur die Fortsetzung des Satzes NACH „Ich habe noch nie …“ (klein geschrieben, ohne Punkt), z.B. `"im Ausland gearbeitet"`. Die App setzt den festen Anfang „Ich habe noch nie …“ selbst davor. |

## Wie die Aussagen im Spiel benutzt werden

- Aus allen ausgewählten Kategorien wird ein gemeinsamer Topf aller Aussagen
  gebildet und einmal komplett gemischt (Shuffle-Bag).
- „Nächste Aussage“ nimmt immer die nächste aus diesem gemischten Topf –
  erst wenn er leer ist, wird neu gemischt. So wiederholt sich nichts,
  solange noch unverbrauchte Aussagen übrig sind.
- Es gibt bewusst KEINE Mitspieler- oder Rollen-Zuordnung wie bei
  Bombe/Impostor – das Spiel zeigt einfach reihum eine Aussage an, der Rest
  läuft verbal am Tisch.

## Neue Kategorie hinzufügen / Aussagen erweitern

Genau wie bei Bombe/Impostor:

1. `categories.json` öffnen.
2. Neue Kategorie: neues Objekt (mit `id`, `label`, `icon`, `words`) in die
   eckigen Klammern einfügen, Komma nach dem vorherigen Objekt nicht
   vergessen.
3. Mehr Aussagen zu einer bestehenden Kategorie: einfach weitere Strings ins
   passende `words`-Array eintragen.
4. Speichern.

## Worauf man achten muss

- Jeder Text in doppelten Anführungszeichen `"..."`.
- Komma zwischen Einträgen, aber **kein** Komma nach dem letzten Eintrag
  einer Liste.
- Eckige Klammern `[ ]` für Listen, geschweifte Klammern `{ }` für einzelne
  Kategorien.
- Am besten die Datei nach dem Speichern kurz mit einem Online-JSON-Checker
  prüfen – ein falsches Zeichen sorgt sonst dafür, dass gar keine
  Kategorien mehr laden.
- Aussagen klein schreiben und ohne Punkt am Ende, da die App den festen
  Satzanfang „Ich habe noch nie …“ automatisch davorsetzt.

## Nach dem Bearbeiten

Wie gewohnt speichern/committen. Da die App offline-fähig ist, kann es sein,
dass Geräte, die die App schon offen hatten, noch die alte Version der Datei
aus dem Cache zeigen – dann hilft in den Einstellungen „Cache löschen“ oder
das Update-Popup bestätigen.
