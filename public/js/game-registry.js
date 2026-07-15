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
  ];

  root.GAMES = GAMES;
})(typeof self !== "undefined" ? self : this);
