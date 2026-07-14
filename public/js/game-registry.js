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
      description: "Gebt das Handy im Kreis weiter, bevor sie hochgeht.",
      icon: "💣",
      color: "red",
      assets: ["/games/bombe/bombe.js", "/games/bombe/bombe.css"],
    },
    {
      id: "truth_dare",
      name: "Wahrheit oder Pflicht",
      description: "Klassiker für die Runde – ehrlich oder mutig?",
      icon: "🎭",
      color: "purple",
      assets: ["/games/truth_dare/truth_dare.js", "/games/truth_dare/truth_dare.css"],
    },
    {
      id: "categories",
      name: "Kategorien",
      description: "Schnell Begriffe zu einer Kategorie finden, bevor die Zeit abläuft.",
      icon: "🗂️",
      color: "green",
      assets: ["/games/categories/categories.js", "/games/categories/categories.css"],
    },
  ];

  root.GAMES = GAMES;
})(typeof self !== "undefined" ? self : this);
