# Kategorien für „Wer bin ich?“

Genau wie bei „Tickende Bombe“, „Impostor“ und „Ich hab noch nie“ stehen alle
Kategorien und Begriffe in einer reinen Daten-Datei: [`categories.json`](categories.json)
in diesem Ordner. Kein Code-Wissen nötig – die App liest die Datei beim Start
ein und zeigt automatisch an, was darin steht.

## Eigene Kategorien direkt in der App erstellen

Für den schnellen Weg ohne Datei-Bearbeitung: In der Kategorie-Auswahl im
Spiel selbst gibt es ganz unten den Button „Eigene Kategorie erstellen“.
Damit angelegte Kategorien landen NICHT in `categories.json`, sondern separat
im Browser-Speicher (localStorage) des Geräts – sie bleiben dort dauerhaft
erhalten, auch nach einem App-Update oder „Cache löschen“.

## Aufbau der Datei

```json
[
  {
    "id": "tiere",
    "label": "Tiere",
    "icon": "🐾",
    "words": ["Löwe", "Elefant", "Pinguin"]
  }
]
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Interner, eindeutiger Name. Nur Kleinbuchstaben, keine Leerzeichen/Umlaute/Sonderzeichen. Bei einer bestehenden Kategorie **nicht mehr ändern**, sonst vergisst die App die gespeicherte Auswahl. |
| `label` | ja | Angezeigter Name der Kategorie. |
| `icon` | ja | Ein Emoji vor dem Namen. |
| `words` | ja | Die möglichen Identitäten dieser Kategorie – Personen, Tiere, Gegenstände oder sonstige Begriffe, ganz wie es passt. |

## Wie die Begriffe im Spiel benutzt werden

- Aus allen ausgewählten Kategorien wird ein gemeinsamer Topf aller Begriffe
  gebildet, gemischt, und jeder Mitspieler bekommt einen eindeutigen Begriff
  zugeteilt (keine Wiederholungen innerhalb einer Runde).
- Beim Reihum-Wischen sieht jede Person NICHT ihren eigenen Begriff, sondern
  die Begriffe aller anderen – genau wie beim klassischen „Wer bin ich“ mit
  Zettel auf der Stirn.
- Es müssen daher mindestens so viele Begriffe in den ausgewählten
  Kategorien vorhanden sein wie Mitspieler mitmachen, sonst erscheint ein
  Hinweis, weitere Kategorien zu aktivieren.

## Neue Kategorie hinzufügen / Begriffe erweitern

Genau wie bei den anderen Spielen:

1. `categories.json` öffnen.
2. Neue Kategorie: neues Objekt (mit `id`, `label`, `icon`, `words`) in die
   eckigen Klammern einfügen, Komma nach dem vorherigen Objekt nicht
   vergessen.
3. Mehr Begriffe zu einer bestehenden Kategorie: einfach weitere Strings ins
   passende `words`-Array eintragen.
4. Speichern.

## Worauf man achten muss

- Jeder Text in doppelten Anführungszeichen `"..."`.
- Komma zwischen Einträgen, aber **kein** Komma nach dem letzten Eintrag
  einer Liste.
- Am besten die Datei nach dem Speichern kurz mit einem Online-JSON-Checker
  prüfen – ein falsches Zeichen sorgt sonst dafür, dass gar keine
  Kategorien mehr laden.

## Nach dem Bearbeiten

Wie gewohnt speichern/committen. Da die App offline-fähig ist, kann es sein,
dass Geräte, die die App schon offen hatten, noch die alte Version der Datei
aus dem Cache zeigen – dann hilft in den Einstellungen „Cache löschen“ oder
das Update-Banner bestätigen.
