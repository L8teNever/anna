# Kategorien für „Tickende Bombe“

Alle Kategorien und Begriffe stehen in [`categories.json`](categories.json) in
diesem Ordner. Das ist eine reine Daten-Datei – zum Hinzufügen oder Erweitern
muss nirgendwo Code angefasst werden. Die App liest die Datei beim Start des
Spiels ein und zeigt automatisch alles an, was darin steht.

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

`categories.json` ist eine Liste (Array) von Kategorie-Objekten:

```json
[
  {
    "id": "automarken",
    "label": "Automarken",
    "icon": "🚗",
    "desc": "Marken und Modelle von Autos.",
    "words": ["BMW", "Audi", "Mercedes", "Volkswagen", "Porsche"]
  },
  {
    "id": "tiere",
    "label": "Tiere",
    "icon": "🐾",
    "desc": "Vom Haustier bis zum Wildtier.",
    "words": ["Löwe", "Elefant", "Giraffe", "Pinguin", "Delfin"]
  }
]
```

### Felder je Kategorie

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Interner, eindeutiger Name der Kategorie. Nur Kleinbuchstaben, keine Leerzeichen/Umlaute/Sonderzeichen (z.B. `automarken`, nicht `Auto-Marken`). Wird u.a. genutzt, um zu merken, welche Kategorien ausgewählt sind – **darf sich bei einer bestehenden Kategorie nicht mehr ändern**, sonst „vergisst“ die App bei bestehenden Spielern, dass die Kategorie mal ausgewählt war. |
| `label` | ja | Name, der den Spielern angezeigt wird (z.B. „Automarken“). Beliebiger Text, darf sich jederzeit ändern. |
| `icon` | ja | Ein einzelnes Emoji, das vor dem Namen angezeigt wird. |
| `desc` | ja | Kurze Beschreibung (ein Satz), die in der Kategorie-Auswahl unter dem Namen steht. |
| `words` | ja | Liste von Begriffen aus dieser Kategorie. Beim Rundenstart wird zufällig **einer** davon als Beispiel eingeblendet (z.B. „z.B. BMW“) – die Spieler dürfen aber trotzdem jeden beliebigen passenden Begriff nennen, das Beispiel ist nur eine Inspiration. |

## Neue Kategorie hinzufügen

1. `categories.json` öffnen.
2. Ein neues Objekt in die eckigen Klammern `[ ... ]` einfügen (Komma nach
   dem vorherigen Objekt nicht vergessen).
3. `id`, `label`, `icon`, `desc` und mindestens ein paar `words` ausfüllen.
4. Speichern.

Beispiel – neue Kategorie „Getränke“ am Ende der Liste ergänzt:

```json
  {
    "id": "getraenke",
    "label": "Getränke",
    "icon": "🥤",
    "desc": "Von Limo bis Kaffee.",
    "words": ["Cola", "Kaffee", "Tee", "Limonade", "Wasser"]
  }
```

## Begriffe zu einer bestehenden Kategorie hinzufügen

Einfach einen weiteren String in das passende `words`-Array eintragen:

```json
"words": ["BMW", "Audi", "Mercedes", "Volkswagen", "Porsche", "Ferrari"]
```

## Worauf man achten muss (typische JSON-Stolperfallen)

- **Jeder Text in doppelten Anführungszeichen** `"..."` – keine einfachen
  Anführungszeichen (`'...'`).
- **Komma zwischen** Objekten/Wörtern, aber **kein Komma nach dem letzten**
  Eintrag einer Liste – ein überzähliges Komma am Ende macht die ganze Datei
  kaputt.
- **Eckige Klammern `[ ]`** für Listen, **geschweifte Klammern `{ }`** für
  einzelne Kategorien – nicht vertauschen.
- Am besten nach dem Speichern kurz die Datei durch einen Online-JSON-Checker
  laufen lassen (z.B. „JSON validieren“ suchen) oder mich fragen – ein
  einzelnes falsches Zeichen sorgt sonst dafür, dass gar keine Kategorien
  mehr laden.
- Kategorien ohne `words` funktionieren zwar (dann wird einfach kein
  Beispiel-Begriff angezeigt), sollten aber trotzdem ein paar Begriffe haben.

## Nach dem Bearbeiten

Damit die Änderung bei allen ankommt: Datei speichern/committen wie gewohnt.
Weil die App offline-fähig ist (Service Worker), kann es sein, dass Geräte,
die die App schon geöffnet hatten, die alte Version der Datei noch aus dem
Cache zeigen – dann hilft in den Einstellungen „Cache löschen“ oder das
Update-Banner bestätigen.
