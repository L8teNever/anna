/**
 * Zentrale Spiele-Registry. Einzige Stelle, die angepasst werden muss, um
 * ein neues Spiel im Startbildschirm, in der Suche und im Offline-Cache
 * (sw.js) erscheinen zu lassen. Klassisches Script (kein Modul), damit es
 * sowohl im Fenster-Kontext als auch im Service-Worker-Kontext per
 * importScripts() funktioniert.
 *
 * assets: zusätzliche Dateien des Spiels, die für Offline-Betrieb
 * vorab gecacht werden müssen (die index.html wird automatisch ergänzt).
 *
 * href: optional - überschreibt die sonst aus `id` abgeleitete Route
 * (`/${id}`). Nötig, wenn zwei Kacheln auf dasselbe Spiel-Verzeichnis
 * zeigen sollen (siehe werwolf-lokal/werwolf-online: beide führen auf
 * `/werwolf`, aber mit ?mode=..., das werwolf.js beim Laden ausliest und
 * den Einzelgerät-/Online-Umschalter direkt vorwählt).
 *
 * requiresOnline: optional - Kachel wird auf der Startseite ausgegraut
 * und ist nicht antippbar, solange das Gerät offline ist (siehe app.js).
 */
(function (root) {
  const GAMES = [
    {
      id: "naeher",
      name: "Wer ist näher dran?",
      tag: "Schätzen",
      description: "Das ultimative, rasante Schätzduell für deine Party.",
      detail: "Tritt mit deinen Freunden an einem Smartphone an. Schätzt skurrile Fakten, geografische Rekorde oder wissenschaftliche Zahlen. Wer am nächsten an der echten Antwort liegt, gewinnt!",
      icon: "target",
      color: "orange",
      minPlayers: 2,
      maxPlayers: 6,
      assets: ["/games/naeher/naeher.js", "/games/naeher/naeher.css", "/games/naeher/categories.json"],
    },
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
    {
      id: "werbinich",
      name: "Wer bin ich?",
      tag: "Rätsel",
      description: "Jeder kennt deine Identität – nur du nicht. Errate sie!",
      detail: "Jede Person bekommt eine geheime Identität – nur sieht sie NICHT die eigene, sondern die aller anderen. Stellt reihum Ja/Nein-Fragen und findet heraus, wer oder was ihr seid!",
      icon: "question",
      color: "teal",
      minPlayers: 3,
      maxPlayers: 12,
      assets: ["/games/werbinich/werbinich.js", "/games/werbinich/werbinich.css", "/games/werbinich/categories.json"],
    },
    {
      id: "eher",
      name: "Wer würde eher",
      tag: "Party",
      description: "Eine Frage nach der anderen – wer passt am besten?",
      detail: "Der Reihe nach zeigt die App eine Frage, die mit „Wer würde eher …“ beginnt. Alle zeigen gleichzeitig auf die Person aus der Gruppe, die am besten passt.",
      icon: "users",
      color: "pink",
      minPlayers: 3,
      maxPlayers: 20,
      assets: ["/games/eher/eher.js", "/games/eher/eher.css", "/games/eher/categories.json"],
    },
    {
      id: "klassiker",
      name: "Klassiker",
      tag: "Brettspiele",
      description: "Tic Tac Toe, 4 Gewinnt und mehr – alle Klassiker an einem Ort.",
      detail: "Eine wachsende Sammlung bekannter Brettspiel-Klassiker zum abwechselnden Spielen auf einem Gerät. Untergame aus der Übersicht wählen und direkt loslegen.",
      icon: "dice",
      color: "amber",
      minPlayers: 2,
      maxPlayers: 2,
      assets: [
        "/games/klassiker/klassiker.js",
        "/games/klassiker/klassiker.css",
        "/games/klassiker/tictactoe.js",
        "/games/klassiker/tictactoe.css",
        "/games/klassiker/connect4.js",
        "/games/klassiker/connect4.css",
      ],
    },
    {
      id: "werwolf-lokal",
      name: "Werwolf – Einzelgerät",
      tag: "Party",
      description: "Ein Handy geht reihum – Rollen bleiben geheim am Tisch.",
      detail: "Das Dorf schläft ein, die Werwölfe wählen ihr Opfer. Tagsüber diskutiert und stimmt das Dorf ab, wer verdächtig ist. Mit optionaler Seherin, Hexe, Amor und Jäger. Ein Gerät wird reihum weitergereicht.",
      icon: "moon",
      color: "indigo",
      minPlayers: 4,
      maxPlayers: 20,
      href: "/werwolf?mode=local",
      assets: ["/games/werwolf/werwolf.js", "/games/werwolf/werwolf.css"],
    },
    {
      id: "werwolf-online",
      name: "Werwolf – Online",
      tag: "Party",
      description: "Jede:r auf dem eigenen Handy – gemeinsame Runde per Link.",
      detail: "Dieselbe Werwolf-Runde, aber jede Person spielt auf ihrem eigenen Gerät. Der Host erstellt einen Raum, alle anderen treten per Link oder QR-Code bei.",
      icon: "moon",
      color: "indigo",
      minPlayers: 4,
      maxPlayers: 20,
      href: "/werwolf?mode=online",
      requiresOnline: true,
      assets: ["/games/werwolf/werwolf.js", "/games/werwolf/werwolf.css"],
    },
  ];

  root.GAMES = GAMES;
})(typeof self !== "undefined" ? self : this);
