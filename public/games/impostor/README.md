# Kategorien für „Impostor“

Genau wie bei „Tickende Bombe“ stehen alle Kategorien und Wörter in einer
reinen Daten-Datei: [`categories.json`](categories.json) in diesem Ordner.
Kein Code-Wissen nötig – die App liest die Datei beim Start ein und zeigt
automatisch an, was darin steht.

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
    "id": "tiere",
    "label": "Tiere",
    "icon": "🐾",
    "desc": "Haustiere und Wildtiere.",
    "words": ["Hund", "Katze", "Elefant", "Löwe", "Pinguin"]
  }
]
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Interner, eindeutiger Name. Nur Kleinbuchstaben, keine Leerzeichen/Umlaute/Sonderzeichen. Bei einer bestehenden Kategorie **nicht mehr ändern**, sonst vergisst die App die gespeicherte Auswahl der Spieler. |
| `label` | ja | Angezeigter Name der Kategorie. |
| `icon` | ja | Ein Emoji vor dem Namen. |
| `desc` | ja | Kurzbeschreibung in der Kategorie-Auswahl. |
| `words` | ja | Die eigentlichen Geheimwörter dieser Kategorie. Pro Runde wird zufällig **ein** Wort daraus gezogen und allen Nicht-Impostoren gezeigt. Je mehr Wörter, desto weniger wiederholt sich eine Kategorie. |

## Wie das Wort im Spiel benutzt wird

- Beim Rundenstart wird zuerst zufällig eine der ausgewählten Kategorien
  gezogen, danach zufällig ein Wort aus deren `words`-Liste.
- Alle normalen Spieler sehen genau dieses Wort.
- Der/die Impostor(e) sehen es **nicht** – stattdessen entweder gar nichts
  oder (falls „Hilfewort“ in den Einstellungen aktiviert ist) ein zweites,
  zufälliges Wort **aus derselben Kategorie** als vager Hinweis.

## Neue Kategorie hinzufügen / Wörter erweitern

Genau wie bei Bombe:

1. `categories.json` öffnen.
2. Neue Kategorie: neues Objekt (mit `id`, `label`, `icon`, `desc`, `words`)
   in die eckigen Klammern einfügen, Komma nach dem vorherigen Objekt nicht
   vergessen.
3. Mehr Wörter zu einer bestehenden Kategorie: einfach weitere Strings ins
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
- Wörter sollten konkrete, gut beschreibbare Dinge sein (Gegenstände, Tiere,
  Orte, Berufe …) – abstrakte Begriffe sind für dieses Spiel schwerer zu
  erraten.

## Nach dem Bearbeiten

Wie gewohnt speichern/committen. Da die App offline-fähig ist, kann es sein,
dass Geräte, die die App schon offen hatten, noch die alte Version der Datei
aus dem Cache zeigen – dann hilft in den Einstellungen „Cache löschen“ oder
das Update-Banner bestätigen.
