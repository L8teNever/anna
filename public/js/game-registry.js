/**
 * Zentrale Spiele-Registry. Einzige Stelle, die angepasst werden muss, um
 * ein neues Spiel im Startbildschirm, in der Suche und im Offline-Cache
 * (sw.js) erscheinen zu lassen. Klassisches Script (kein Modul), damit es
 * sowohl im Fenster-Kontext als auch im Service-Worker-Kontext per
 * importScripts() funktioniert.
 *
 * assets: zusätzliche Dateien des Spiels, die für Offline-Betrieb
 * vorab gecacht werden müssen (die index.html wird automatisch ergänzt).
 */
(function (root) {
  const GAMES = [
    {
      id: "bombe",
      name: "Tickende Bombe",
      tag: "Party",
      description: "Gebt das Handy im Kreis weiter, bevor sie hochgeht.",
      detail: "Reagiere schnell, nenn einen Begriff aus der Kategorie und reiche das Gerät weiter, bevor die Bombe in deinen Händen hochgeht!",
      icon: "bomb",
      color: "red",
      minPlayers: 2,
      maxPlayers: 8,
      assets: ["/games/bombe/bombe.js", "/games/bombe/bombe.css", "/games/bombe/categories.json"],
    },
    {
      id: "truth_dare",
      name: "Wahrheit oder Pflicht",
      tag: "Klassiker",
      description: "Klassiker für die Runde – ehrlich oder mutig?",
      detail: "Reihum an der Reihe: Wahrheit oder Pflicht wählen und eine zufällige Frage oder Aufgabe aus dem gewählten Modus bekommen.",
      icon: "masks",
      color: "purple",
      minPlayers: 2,
      maxPlayers: 12,
      assets: ["/games/truth_dare/truth_dare.js", "/games/truth_dare/truth_dare.css", "/games/truth_dare/prompts.json"],
    },
    {
      id: "categories",
      name: "Kategorien",
      tag: "Schnell",
      description: "Schnell Begriffe zu einer Kategorie finden, bevor die Zeit abläuft.",
      detail: "Zu einer zufälligen Kategorie und einem zufälligen Buchstaben muss reihum laut ein passender Begriff genannt werden, bevor der Timer abläuft.",
      icon: "grid",
      color: "green",
      minPlayers: 1,
      maxPlayers: 12,
      assets: ["/games/categories/categories.js", "/games/categories/categories.css", "/games/categories/categories.json"],
    },
  ];

  root.GAMES = GAMES;
})(typeof self !== "undefined" ? self : this);
