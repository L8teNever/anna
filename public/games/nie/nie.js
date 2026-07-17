/**
 * Ich hab noch nie – der Reihe nach zeigt die App eine Aussage aus den
 * gewählten Kategorien ("Ich habe noch nie …"). Kein Rollen-/Geheimwort-
 * Mechanismus wie bei Bombe/Impostor nötig: einfach Aussage anzeigen,
 * "Nächste Aussage" tippen, weiter geht's. Läuft daher auch ohne
 * Mitspieler-Auswahl.
 */
(function () {
  const setupView = document.getElementById("setup-view");
  const categorySelectView = document.getElementById("view-category-select");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const startButton = document.getElementById("start-button");
  const nextStatementButton = document.getElementById("next-statement-button");
  const exitButton = document.getElementById("exit-button");

  const openCategorySelectBtn = document.getElementById("open-category-select-button");
  const categoryBackButton = document.getElementById("category-select-back-button");
  const categoryConfirmButton = document.getElementById("category-select-confirm-button");

  const nieCard = document.getElementById("nie-card");
  const statementText = document.getElementById("nie-statement-text");
  const categoryLabelEl = document.getElementById("nie-category-label");

  const categoryPicker = CategoryPicker.create("nie", "/games/nie/categories.json");

  /* ------------------------------------------------------------------ */
  /* Ansichten wechseln                                                    */
  /* ------------------------------------------------------------------ */
  openCategorySelectBtn.addEventListener("click", () => ViewNav.transition(setupView, categorySelectView));
  categoryBackButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));
  categoryConfirmButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Aussagen-Nachschub: Shuffle-Bag statt reinem Zufall, damit sich          */
  /* Aussagen erst wiederholen, wenn wirklich alle einmal dran waren.         */
  /* ------------------------------------------------------------------ */
  let queue = [];
  let lastShown = null;

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function allStatements() {
    const active = categoryPicker.getSelectedCategories();
    const statements = [];
    active.forEach((cat) => {
      if (!Array.isArray(cat.words)) return;
      cat.words.forEach((text) => statements.push({ text, categoryLabel: cat.label, categoryIcon: cat.icon }));
    });
    return statements;
  }

  function refillQueue() {
    const pool = allStatements();
    queue = shuffle(pool);
    // Direkte Wiederholung der zuletzt gezeigten Aussage vermeiden, falls
    // sie durch Zufall wieder ganz vorne landet und es Alternativen gibt.
    if (queue.length > 1 && lastShown && queue[0].text === lastShown.text) {
      [queue[0], queue[1]] = [queue[1], queue[0]];
    }
  }

  function showNextStatement() {
    if (!queue.length) refillQueue();
    const next = queue.shift();

    if (!next) {
      statementText.textContent = "Keine Aussagen in den gewählten Kategorien – bitte andere Kategorien wählen.";
      categoryLabelEl.textContent = "";
      return;
    }

    lastShown = next;
    statementText.textContent = next.text;
    categoryLabelEl.textContent = `${next.categoryIcon || ""} ${next.categoryLabel}`.trim();

    // Kurzer Fade/Scale-Wechsel statt hartem Sprung.
    nieCard.classList.remove("nie-card--changing");
    void nieCard.offsetWidth;
    nieCard.classList.add("nie-card--changing");
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Steuerung                                                     */
  /* ------------------------------------------------------------------ */
  function startRound() {
    if (!allStatements().length) {
      Toast.show("Bitte mindestens eine Kategorie mit Aussagen auswählen", "alert-triangle");
      return;
    }
    queue = [];
    lastShown = null;
    ViewNav.transition(setupView, playView);
    showNextStatement();
  }

  startButton.addEventListener("click", startRound);
  nextStatementButton.addEventListener("click", showNextStatement);
  exitButton.addEventListener("click", () => { window.location.href = "/"; });

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die laufende Runde wird abgebrochen.",
        confirmLabel: "Verlassen",
        onConfirm: () => ViewNav.transition(playView, setupView),
      });
      return;
    }
    if (!categorySelectView.hidden) {
      ViewNav.transition(categorySelectView, setupView);
      return;
    }
    window.location.href = "/";
  });

  // Bestätigung beim System-Zurück (Android/iOS-Zurück-Geste, siehe
  // view-nav.js) – die lässt sich nur synchron per window.confirm()
  // abfangen, ein eigenes Dialogfenster kann die Browser-Navigation nicht
  // rechtzeitig aufhalten.
  window.confirmGameExit = function () {
    const currentActive = document.querySelector(".app-view:not([hidden])");
    if (currentActive && currentActive.id === "play-view") {
      return confirm("Möchtest du das laufende Spiel wirklich beenden?");
    }
    return true;
  };
})();
