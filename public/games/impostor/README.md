# Kategorien für „Impostor“

Alle Kategorien und Wörter stehen in einer reinen Daten-Datei:
[`categories.json`](categories.json) in diesem Ordner. Kein Code-Wissen
nötig – die App liest die Datei beim Start ein und zeigt automatisch an,
was darin steht.

## Eigene Kategorien direkt in der App erstellen

Für den schnellen Weg ohne Datei-Bearbeitung: In der Kategorie-Auswahl im
Spiel selbst gibt es ganz unten den Button „Eigene Kategorie erstellen“.
Damit angelegte Kategorien landen NICHT in `categories.json`, sondern separat
im Browser-Speicher (localStorage) des Geräts – sie bleiben dort dauerhaft
erhalten, auch nach einem App-Update über den „Aktualisieren“-Button oder
„Cache löschen“ (beides betrifft nur den Datei-Cache, nie den lokalen
Speicher). Eigene Kategorien lassen sich in der Auswahl über die Stift- bzw.
X-Buttons direkt an der jeweiligen Zeile bearbeiten oder löschen.

**Wichtig:** Der Erstellen-Dialog in der App fragt nur schlichte Wörter ab,
kein Hilfewort/keine Beschreibung (siehe unten) – eigene Kategorien nutzen
für den Impostor-Hinweis automatisch den Kategorienamen als Fallback (wie
früher bei allen Kategorien).

Der Rest dieser Anleitung bezieht sich auf den anderen Weg: Kategorien fest
in `categories.json` eintragen, z. B. wenn sie für alle Geräte gleich
vorinstalliert sein sollen.

## Aufbau der Datei

```json
[
  {
    "id": "tiere",
    "label": "Tiere",
    "icon": "🐾",
    "words": [
      { "word": "Hund", "hint": "Wolf" },
      {
        "word": "Kamasutra",
        "hint": "Stellungswechsel",
        "description": "Ein altindisches Buch mit Beschreibungen verschiedenster Liebesstellungen."
      }
    ]
  }
]
```

### Felder je Kategorie

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Interner, eindeutiger Name. Nur Kleinbuchstaben, keine Leerzeichen/Umlaute/Sonderzeichen. Bei einer bestehenden Kategorie **nicht mehr ändern**, sonst vergisst die App die gespeicherte Auswahl der Spieler. |
| `label` | ja | Angezeigter Name der Kategorie. |
| `icon` | ja | Ein Emoji vor dem Namen. |
| `words` | ja | Liste von Wort-Objekten (siehe unten). Pro Runde wird zufällig **ein** Objekt daraus gezogen. |

### Felder je Wort-Objekt

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `word` | ja | Das eigentliche Geheimwort – wird allen Nicht-Impostoren gezeigt. |
| `hint` | nein, aber empfohlen | Das Hilfewort für den/die Impostor(e), falls „Kategorie-Hinweis“ in den Einstellungen aktiviert ist (siehe unten). Fehlt es, fällt die App auf den Kategorienamen zurück. |
| `description` | nein | Kurze Erklärung für unbekanntere Begriffe (v. a. in den Spicy-Kategorien). Erscheint als „Was bedeutet das?“-Button auf der Karte des/der Wort-Halter:in – NICHT beim Impostor. |

## Das Hilfewort (`hint`) richtig wählen

Das war schon mal falsch und ist wichtig genug für einen eigenen Absatz:
**Das Hilfewort darf kein Synonym und kein Ober-/Unterbegriff des
Geheimworts sein** – sonst verrät es die Lösung direkt statt nur eine grobe
Richtung vorzugeben. Schlechte Beispiele (tatsächlich so drin gewesen und
korrigiert):

- ❌ `"word": "Sex", "hint": "Liebe machen"` – reines Synonym, verrät alles.
- ❌ `"word": "Zoo", "hint": "Tierpark"` – ebenfalls dasselbe Wort auf
  Deutsch.
- ❌ `"word": "Analplug", "hint": "Buttplug"` – dasselbe Ding, anderer
  Name.
- ❌ `"word": "Klassenarbeit", "hint": "Prüfung"` – praktisch identisch.

Gutes Hilfewort = gleiches Themengebiet, aber ein wirklich **anderer**,
konkreter Begriff:

- ✅ `"word": "Hund", "hint": "Wolf"`
- ✅ `"word": "Pizza", "hint": "Flammkuchen"`
- ✅ `"word": "Golf", "hint": "Bogenschießen"`

Faustregel beim Schreiben: Wenn jemand nur das Hilfewort hört – könnte
er/sie das Geheimwort *erraten*, aber nicht einfach *ableiten*? Wenn die
Antwort "das ist ja fast dasselbe" lautet, nochmal überarbeiten.

## Wie das Wort im Spiel benutzt wird

- Beim Rundenstart wird zuerst zufällig eine der ausgewählten Kategorien
  gezogen, danach zufällig ein Wort-Objekt aus deren `words`-Liste.
- Alle normalen Spieler sehen `word`.
- Der/die Impostor(e) sehen es **nicht** – stattdessen entweder gar nichts,
  oder (falls „Kategorie-Hinweis“ in den Einstellungen aktiviert ist) das
  `hint`-Wort dieses Eintrags (Fallback: der Kategoriename, falls kein
  `hint` gesetzt ist).
- Hat der Eintrag eine `description`, sieht der/die Wort-Halter:in nach dem
  ersten Ansehen der Karte einen „Was bedeutet das?“-Button, der die
  Erklärung einblendet.

## Neue Kategorie hinzufügen / Wörter erweitern

1. `categories.json` öffnen.
2. Neue Kategorie: neues Objekt (mit `id`, `label`, `icon`, `words`) in die
   eckigen Klammern einfügen, Komma nach dem vorherigen Objekt nicht
   vergessen.
3. Mehr Wörter zu einer bestehenden Kategorie: einfach weitere
   `{ "word": "...", "hint": "..." }`-Objekte ins passende `words`-Array
   eintragen.
4. Speichern.

## Worauf man achten muss

- Jeder Text in doppelten Anführungszeichen `"..."`.
- Komma zwischen Einträgen, aber **kein** Komma nach dem letzten Eintrag
  einer Liste.
- Eckige Klammern `[ ]` für Listen, geschweifte Klammern `{ }` für einzelne
  Kategorien **und** für jedes einzelne Wort-Objekt.
- Am besten die Datei nach dem Speichern kurz mit einem Online-JSON-Checker
  prüfen – ein falsches Zeichen sorgt sonst dafür, dass gar keine
  Kategorien mehr laden.
- Wörter sollten konkrete, gut beschreibbare Dinge sein (Gegenstände, Tiere,
  Orte, Berufe …) – abstrakte Begriffe sind für dieses Spiel schwerer zu
  erraten.
- Hilfewort immer gegen die Faustregel oben prüfen, bevor gespeichert wird.

## Nach dem Bearbeiten

Wie gewohnt speichern/committen. Da die App offline-fähig ist, kann es sein,
dass Geräte, die die App schon offen hatten, noch die alte Version der Datei
aus dem Cache zeigen – dann hilft in den Einstellungen „Cache löschen“ oder
das Update-Popup bestätigen.
