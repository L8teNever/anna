/**
 * Wer würde eher – der Reihe nach zeigt die App eine Frage aus den
 * gewählten Kategorien ("Wer würde eher …"). Alle zeigen gleichzeitig auf
 * die Person, die am besten passt – das Zeigen/Zählen läuft komplett
 * verbal am Tisch, die App übernimmt nur die Fragen. Kein Rollen-/Geheim-
 * wort-Mechanismus wie bei Bombe/Impostor nötig, läuft daher auch ohne
 * Mitspieler-Auswahl.
 */
(function () {
  const setupView = document.getElementById("setup-view");
  const categorySelectView = document.getElementById("view-category-select");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const startButton = document.getElementById("start-button");
  const nextStatementButton = document.getElementById("next-statement-button");

  const openCategorySelectBtn = document.getElementById("open-category-select-button");
  const categoryBackButton = document.getElementById("category-select-back-button");
  const categoryConfirmButton = document.getElementById("category-select-confirm-button");

  const eherCard = document.getElementById("eher-card");
  const statementText = document.getElementById("eher-statement-text");
  const categoryLabelEl = document.getElementById("eher-category-label");
  const quickRatingEl = document.getElementById("quick-rating");

  const categoryPicker = CategoryPicker.create("eher", "/games/eher/categories.json");

  /* ------------------------------------------------------------------ */
  /* Ansichten wechseln                                                    */
  /* ------------------------------------------------------------------ */
  openCategorySelectBtn.addEventListener("click", () => ViewNav.transition(setupView, categorySelectView));
  categoryBackButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));
  categoryConfirmButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Fragen-Nachschub: Shuffle-Bag statt reinem Zufall, damit sich          */
  /* Fragen erst wiederholen, wenn wirklich alle einmal dran waren.          */
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
    // Direkte Wiederholung der zuletzt gezeigten Frage vermeiden, falls sie
    // durch Zufall wieder ganz vorne landet und es Alternativen gibt.
    if (queue.length > 1 && lastShown && queue[0].text === lastShown.text) {
      [queue[0], queue[1]] = [queue[1], queue[0]];
    }
  }

  function showNextStatement() {
    if (!queue.length) refillQueue();
    const next = queue.shift();

    if (!next) {
      statementText.textContent = "Keine Fragen in den gewählten Kategorien – bitte andere Kategorien wählen.";
      categoryLabelEl.textContent = "";
      if (quickRatingEl) quickRatingEl.hidden = true;
      return;
    }

    lastShown = next;
    statementText.textContent = next.text;
    categoryLabelEl.textContent = `${next.categoryIcon || ""} ${next.categoryLabel}`.trim();

    if (quickRatingEl) {
      quickRatingEl.hidden = true;
      GithubFeedback.renderQuickRating(quickRatingEl, {
        gameId: "eher",
        gameName: "Wer würde eher",
        categoryLabel: next.categoryLabel,
        word: next.text,
      });
    }

    // Kurzer Fade/Scale-Wechsel statt hartem Sprung.
    eherCard.classList.remove("eher-card--changing");
    void eherCard.offsetWidth;
    eherCard.classList.add("eher-card--changing");
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Steuerung                                                     */
  /* ------------------------------------------------------------------ */
  function startRound() {
    if (!allStatements().length) {
      Toast.show("Bitte mindestens eine Kategorie mit Fragen auswählen", "alert-triangle");
      return;
    }
    queue = [];
    lastShown = null;
    ViewNav.transition(setupView, playView);
    showNextStatement();
  }

  startButton.addEventListener("click", startRound);
  nextStatementButton.addEventListener("click", showNextStatement);

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
    PageTransition.navigate("/");
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
