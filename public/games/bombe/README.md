# Kategorien für „Tickende Bombe“

Alle Kategorien und Prompts stehen in [`categories.json`](categories.json) in
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
in `categories.json` eintragen, z. B. wenn sie für alle Geräte gleich
vorinstalliert sein sollen.

## Wichtig: Was ein „Wort“ hier eigentlich ist

Anders als der Feldname `words` vermuten lässt, ist jeder Eintrag darin
**kein einzelnes Beispielwort**, sondern ein ganzer **Nenn-Prompt** – die
Aufgabe für die gesamte Runde. Beim Rundenstart wird zufällig eine
Kategorie und daraus zufällig **ein** Prompt gezogen; dieser Prompt wird
groß angezeigt, und reihum muss jede Person, die die Bombe hält, einen
**neuen, noch nicht genannten** Begriff nennen, der dazu passt – bevor sie
weitergibt. Beispiel: Prompt „Dinge auf einer Pizza“ → gültige Antworten
sind u. a. „Salami“, „Käse“, „Ananas“, „Pilze“ … Die App prüft die
genannten Begriffe nicht (reines Verbalspiel), sie zeigt nur den Prompt an
und lässt die Bombe hochgehen.

**Für gute Prompts gilt:** je mehr verschiedene, leicht zu findende
Antworten ein Prompt zulässt, desto besser – ein Prompt mit nur 3-4
möglichen Antworten führt schnell zu Wiederholungen/Stillstand und ist
langweilig zu spielen.

## Aufbau der Datei

`categories.json` ist eine Liste (Array) von Kategorie-Objekten:

```json
[
  {
    "id": "fressen_saufen",
    "label": "Fressen & Saufen",
    "icon": "🍕",
    "words": [
      "Dinge auf einer Pizza",
      "Fast-Food-Gerichte",
      "Was man zum Frühstück isst"
    ]
  }
]
```

### Felder je Kategorie

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Interner, eindeutiger Name der Kategorie. Nur Kleinbuchstaben, keine Leerzeichen/Umlaute/Sonderzeichen (z. B. `fressen_saufen`, nicht `Fressen & Saufen`). Wird u. a. genutzt, um zu merken, welche Kategorien ausgewählt sind – **darf sich bei einer bestehenden Kategorie nicht mehr ändern**, sonst „vergisst“ die App bei bestehenden Spielern, dass die Kategorie mal ausgewählt war. |
| `label` | ja | Name, der den Spielern angezeigt wird (z. B. „Fressen & Saufen“). Beliebiger Text, darf sich jederzeit ändern. |
| `icon` | ja | Ein einzelnes Emoji, das vor dem Namen angezeigt wird. |
| `words` | ja | Liste der Nenn-Prompts dieser Kategorie (siehe oben – **keine** einzelnen Beispielwörter, sondern ganze Aufgaben wie „Dinge, die man im Bett verliert“). Pro Runde wird zufällig **einer** davon gezogen. |

## Neuen Prompt / neue Kategorie hinzufügen

1. `categories.json` öffnen.
2. Neue Kategorie: neues Objekt (mit `id`, `label`, `icon`, `words`) in die
   eckigen Klammern `[ ... ]` einfügen (Komma nach dem vorherigen Objekt
   nicht vergessen).
3. Mehr Prompts zu einer bestehenden Kategorie: einfach einen weiteren
   String ins passende `words`-Array eintragen.
4. Speichern.

Beispiel – neuer Prompt in einer bestehenden Kategorie ergänzt:

```json
"words": ["Dinge auf einer Pizza", "Fast-Food-Gerichte", "Cocktails, die man kennen sollte"]
```

## Worauf man achten muss (typische JSON-Stolperfallen)

- **Jeder Text in doppelten Anführungszeichen** `"..."` – keine einfachen
  Anführungszeichen (`'...'`).
- **Komma zwischen** Einträgen, aber **kein Komma nach dem letzten**
  Eintrag einer Liste – ein überzähliges Komma am Ende macht die ganze
  Datei kaputt.
- **Eckige Klammern `[ ]`** für Listen, **geschweifte Klammern `{ }`** für
  einzelne Kategorien – nicht vertauschen.
- Am besten nach dem Speichern kurz die Datei durch einen Online-JSON-Checker
  laufen lassen (z. B. „JSON validieren“ suchen) – ein einzelnes falsches
  Zeichen sorgt sonst dafür, dass gar keine Kategorien mehr laden.
- Prompts so formulieren, dass viele verschiedene, schnell auffindbare
  Antworten möglich sind (siehe Hinweis oben) – sonst ist die Runde schnell
  vorbei oder langweilig.

## Nach dem Bearbeiten

Damit die Änderung bei allen ankommt: Datei speichern/committen wie gewohnt.
Weil die App offline-fähig ist (Service Worker), kann es sein, dass Geräte,
die die App schon geöffnet hatten, die alte Version der Datei noch aus dem
Cache zeigen – dann hilft in den Einstellungen „Cache löschen“ oder das
Update-Popup bestätigen.
