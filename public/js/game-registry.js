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
      id: "impostor",
      name: "Impostor",
      tag: "Bluff",
      description: "Alle außer dem Impostor kennen das Geheimwort.",
      detail: "Alle außer dem Impostor sehen ein geheimes Wort. Reihum beschreibt ihr es, ohne es zu sagen – der Impostor muss mitreden, ohne aufzufliegen.",
      icon: "masks",
      color: "purple",
      minPlayers: 3,
      maxPlayers: 12,
      assets: ["/games/impostor/impostor.js", "/games/impostor/impostor.css", "/games/impostor/categories.json"],
    },
    {
      id: "nie",
      name: "Ich hab noch nie",
      tag: "Trinkspiel",
      description: "Eine Aussage nach der anderen – wer war's schon mal?",
      detail: "Der Reihe nach zeigt die App eine Aussage, die mit „Ich habe noch nie …“ beginnt. Wer das schon mal gemacht hat, trinkt, nimmt einen Schluck oder macht einen Finger runter – ganz wie ihr wollt.",
      icon: "drink",
      color: "green",
      minPlayers: 2,
      maxPlayers: 20,
      assets: ["/games/nie/nie.js", "/games/nie/nie.css", "/games/nie/categories.json"],
    },
    {
      id: "shapes",
      name: "Perfekte Form",
      tag: "Geschick",
      description: "Zeichne eine Form freihand – wie perfekt wird sie?",
      detail: "Wähle eine Form, zeichne sie so genau wie möglich mit dem Finger auf den Bildschirm und lass dir per Prozentzahl anzeigen, wie perfekt sie geworden ist. Reihum probieren – wer schafft die höchste Punktzahl?",
      icon: "shapes",
      color: "orange",
      minPlayers: 1,
      maxPlayers: 20,
      assets: ["/games/shapes/shapes.js", "/games/shapes/shapes.css"],
    },
  ];

  root.GAMES = GAMES;
})(typeof self !== "undefined" ? self : this);
