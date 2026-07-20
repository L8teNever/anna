/**
 * Wer ist näher dran? – Das Schätzduell für Partys
 */
(function () {
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 6;

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                     */
  /* ------------------------------------------------------------------ */
  const setupView = document.getElementById("setup-view");
  const categorySelectView = document.getElementById("view-category-select");
  const playerSelectView = document.getElementById("view-player-select");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const startButton = document.getElementById("start-button");

  const openCategorySelectBtn = document.getElementById("open-category-select-button");
  const categoryBackButton = document.getElementById("category-select-back-button");
  const categoryConfirmButton = document.getElementById("category-select-confirm-button");

  const playerSummary = document.getElementById("player-select-summary");
  const openPlayerSelectBtn = document.getElementById("open-player-select-button");
  const playerBackButton = document.getElementById("player-select-back-button");
  const playerConfirmButton = document.getElementById("player-select-confirm-button");

  const validationWarning = document.getElementById("validation-warning");
  const validationWarningText = document.getElementById("validation-warning-text");

  // State sections inside play-view
  const playStateReady = document.getElementById("play-state-ready");
  const playStateInput = document.getElementById("play-state-input");
  const playStateReveal = document.getElementById("play-state-reveal");

  // State Ready Elements
  const nextPlayerName = document.getElementById("next-player-name");
  const btnStartGuess = document.getElementById("btn-start-guess");

  // State Input Elements
  const inputQuestionText = document.getElementById("input-question-text");
  const inputPlayerName = document.getElementById("input-player-name");
  const guessValueDisplay = document.getElementById("guess-value-display");
  const guessUnitDisplay = document.getElementById("guess-unit-display");
  const guessSlider = document.getElementById("guess-slider");
  const btnGuessMinus = document.getElementById("btn-guess-minus");
  const btnGuessAdd = document.getElementById("btn-guess-add");
  const limitMinDisplay = document.getElementById("limit-min");
  const limitMaxDisplay = document.getElementById("limit-max");
  const btnLockGuess = document.getElementById("btn-lock-guess");

  // State Reveal Elements
  const revealQuestionText = document.getElementById("reveal-question-text");
  const revealCorrectAnswer = document.getElementById("reveal-correct-answer");
  const revealUnitDisplay = document.getElementById("reveal-unit-display");
  const rulerWrapper = document.getElementById("ruler-wrapper");
  const rulerTrack = document.getElementById("ruler-track");
  const rulerLabelMin = document.getElementById("ruler-label-min");
  const rulerLabelMax = document.getElementById("ruler-label-max");
  const roundResultsContainer = document.getElementById("round-results-container");
  const roundResultsList = document.getElementById("round-results-list");
  const btnRevealAnswer = document.getElementById("btn-reveal-answer");

  // End Actions
  const revealEndActions = document.getElementById("reveal-end-actions");
  const quickRatingReveal = document.getElementById("quick-rating-reveal");
  const btnRestartGame = document.getElementById("btn-restart-game");
  const btnExitToHome = document.getElementById("btn-exit-to-home");

  /* ------------------------------------------------------------------ */
  /* Pickers and Game State                                             */
  /* ------------------------------------------------------------------ */
  const playerPicker = PlayerPicker.create();
  const categoryPicker = CategoryPicker.create("naeher", "/games/naeher/categories.json");

  let questionPool = [];
  let currentQuestion = null;
  let playerScores = {}; // name -> number
  let roundGuesses = {}; // name -> number
  let currentPlayerIndex = 0;
  let isGameActive = false;

  /* ------------------------------------------------------------------ */
  /* UI Helper functions                                                */
  /* ------------------------------------------------------------------ */
  function showState(stateName) {
    playStateReady.hidden = (stateName !== "ready");
    playStateInput.hidden = (stateName !== "input");
    playStateReveal.hidden = (stateName !== "reveal");
  }

  function updatePlayerSummary() {
    const count = playerPicker.getActiveCount();
    playerSummary.textContent = count === 1 ? "1 Spieler ausgewählt" : `${count} Spieler ausgewählt`;
    updateValidation(count);
  }

  function updateValidation(count) {
    const valid = count >= MIN_PLAYERS && count <= MAX_PLAYERS;
    validationWarning.hidden = valid;
    if (!valid) {
      validationWarningText.textContent = count < MIN_PLAYERS
        ? `Mindestens ${MIN_PLAYERS} Mitspieler nötig (aktuell ${count}).`
        : `Höchstens ${MAX_PLAYERS} Mitspieler möglich (aktuell ${count}).`;
    }
    startButton.disabled = !valid;
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  // Navigation handlers
  openCategorySelectBtn.addEventListener("click", () => ViewNav.transition(setupView, categorySelectView));
  categoryBackButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));
  categoryConfirmButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Question Parsing Helper                                            */
  /* ------------------------------------------------------------------ */
  function parseQuestion(q) {
    if (typeof q === "object" && q !== null) {
      return {
        word: q.word || q.question || "Schätzfrage?",
        answer: q.answer !== undefined ? Number(q.answer) : 50,
        unit: q.unit || "",
        min: q.min !== undefined ? Number(q.min) : 0,
        max: q.max !== undefined ? Number(q.max) : 100
      };
    }
    // Fallback parsing for custom categories: "QuestionText;answer;unit;min;max"
    const str = String(q);
    const parts = str.split(";");
    if (parts.length >= 2) {
      const word = parts[0].trim();
      const answer = Number(parts[1].trim()) || 0;
      const unit = parts[2] ? parts[2].trim() : "";
      const min = parts[3] !== undefined ? Number(parts[3].trim()) : 0;
      const max = parts[4] !== undefined ? Number(parts[4].trim()) : (answer * 2 || 100);
      return { word, answer, unit, min, max };
    }
    return {
      word: str,
      answer: 50,
      unit: "",
      min: 0,
      max: 100
    };
  }

  /* ------------------------------------------------------------------ */
  /* Game Loop                                                          */
  /* ------------------------------------------------------------------ */
  function startRound() {
    const activePlayers = playerPicker.getSelectedNames();
    if (activePlayers.length < MIN_PLAYERS || activePlayers.length > MAX_PLAYERS) return;

    const selectedCats = categoryPicker.getSelectedCategories();
    if (!selectedCats.length) {
      if (window.Toast) Toast.show("Bitte wähle mindestens eine Kategorie!", "alert-triangle");
      return;
    }

    // Collect and parse questions
    let rawPool = [];
    selectedCats.forEach(cat => {
      if (Array.isArray(cat.words)) {
        rawPool = rawPool.concat(cat.words);
      }
    });

    if (!rawPool.length) {
      if (window.Toast) Toast.show("Die gewählten Kategorien enthalten keine Fragen!", "alert-triangle");
      return;
    }

    // Map and shuffle
    questionPool = rawPool.map(parseQuestion);
    questionPool.sort(() => Math.random() - 0.5);

    // Initialize state
    playerScores = {};
    activePlayers.forEach(name => { playerScores[name] = 0; });
    isGameActive = true;

    Sound.unlock();
    ViewNav.transition(setupView, playView);
    startNextRound();
  }

  function startNextRound() {
    if (!questionPool.length) {
      // Re-populate question pool if empty
      const selectedCats = categoryPicker.getSelectedCategories();
      let rawPool = [];
      selectedCats.forEach(cat => {
        if (Array.isArray(cat.words)) rawPool = rawPool.concat(cat.words);
      });
      questionPool = rawPool.map(parseQuestion);
      questionPool.sort(() => Math.random() - 0.5);
    }

    currentQuestion = questionPool.pop();
    roundGuesses = {};
    currentPlayerIndex = 0;

    showReadyScreen();
  }

  function showReadyScreen() {
    showState("ready");
    const activePlayers = playerPicker.getSelectedNames();
    nextPlayerName.textContent = activePlayers[currentPlayerIndex];
  }

  btnStartGuess.addEventListener("click", () => {
    showInputScreen();
  });

  function showInputScreen() {
    showState("input");
    const activePlayers = playerPicker.getSelectedNames();
    const name = activePlayers[currentPlayerIndex];

    inputPlayerName.textContent = name;
    inputQuestionText.textContent = currentQuestion.word;
    guessUnitDisplay.textContent = currentQuestion.unit;

    // Configure slider
    guessSlider.min = currentQuestion.min;
    guessSlider.max = currentQuestion.max;
    
    // Set initial value to midpoint
    const midpoint = Math.round((currentQuestion.min + currentQuestion.max) / 2);
    guessSlider.value = midpoint;
    updateSliderDisplay(midpoint);

    limitMinDisplay.textContent = `Min: ${currentQuestion.min}`;
    limitMaxDisplay.textContent = `Max: ${currentQuestion.max}`;
  }

  function updateSliderDisplay(val) {
    guessValueDisplay.textContent = val;
  }

  guessSlider.addEventListener("input", (e) => {
    updateSliderDisplay(e.target.value);
  });

  // Precise adjustment helper
  function adjustGuess(diff) {
    let val = Number(guessSlider.value) + diff;
    val = Math.max(Number(guessSlider.min), Math.min(Number(guessSlider.max), val));
    guessSlider.value = val;
    updateSliderDisplay(val);
    Sound.tick(500 + val % 100);
  }

  btnGuessMinus.addEventListener("click", () => adjustGuess(-1));
  btnGuessAdd.addEventListener("click", () => adjustGuess(1));

  btnLockGuess.addEventListener("click", () => {
    const activePlayers = playerPicker.getSelectedNames();
    const name = activePlayers[currentPlayerIndex];
    roundGuesses[name] = Number(guessSlider.value);

    Sound.beep(600, 0.1);

    currentPlayerIndex++;
    if (currentPlayerIndex < activePlayers.length) {
      showReadyScreen();
    } else {
      showRevealScreen();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Suspense Reveal                                                    */
  /* ------------------------------------------------------------------ */
  function showRevealScreen() {
    showState("reveal");
    revealQuestionText.textContent = currentQuestion.word;
    revealCorrectAnswer.textContent = "?";
    revealCorrectAnswer.classList.remove("revealed");
    revealUnitDisplay.textContent = "";

    rulerWrapper.hidden = true;
    roundResultsContainer.hidden = true;
    btnRevealAnswer.hidden = false;
    revealEndActions.hidden = true;
    quickRatingReveal.hidden = true;
  }

  btnRevealAnswer.addEventListener("click", () => {
    btnRevealAnswer.hidden = true;
    revealAnswerSuspense();
  });

  function revealAnswerSuspense() {
    const targetVal = currentQuestion.answer;
    const minVal = currentQuestion.min;
    const maxVal = currentQuestion.max;
    
    // Ticking animation
    const duration = 1500; // ms
    const startTime = performance.now();
    const startVal = Math.round((minVal + maxVal) / 2);

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Easing out quadratic
      const easeProgress = progress * (2 - progress);
      const currentVal = Math.round(startVal + (targetVal - startVal) * easeProgress);
      
      revealCorrectAnswer.textContent = currentVal;
      Sound.tick(400 + (currentVal % 300));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Reveal end state
        revealCorrectAnswer.textContent = targetVal;
        revealCorrectAnswer.classList.add("revealed");
        revealUnitDisplay.textContent = currentQuestion.unit;
        Sound.success();

        // Calculate scores and render ruler/results
        evaluateRound();
      }
    }

    requestAnimationFrame(tick);
  }

  function evaluateRound() {
    const targetVal = currentQuestion.answer;
    const minVal = currentQuestion.min;
    const maxVal = currentQuestion.max;
    const range = maxVal - minVal || 100;
    
    const activePlayers = playerPicker.getSelectedNames();
    const roundResults = [];

    activePlayers.forEach(name => {
      const guess = roundGuesses[name];
      const deviation = Math.abs(guess - targetVal);
      const percentError = Math.min(1, deviation / range);
      
      // Points allocation: up to 1000 points
      let points = Math.round(1000 * (1 - percentError));
      points = Math.max(0, points);

      // Exact match bonus (+500 points)
      const exactMatch = (deviation === 0);
      if (exactMatch) points += 500;

      playerScores[name] = (playerScores[name] || 0) + points;

      roundResults.push({
        name,
        guess,
        deviation,
        points,
        exactMatch
      });
    });

    // Sort round results by closeness (ascending deviation)
    roundResults.sort((a, b) => a.deviation - b.deviation);

    // Plot pins on virtual ruler
    renderRulerPins(roundResults, targetVal, minVal, maxVal);

    // Render results list
    renderRoundResultsList(roundResults);

    rulerWrapper.hidden = false;
    roundResultsContainer.hidden = false;
    revealEndActions.hidden = false;

    // Quick Feedback
    if (quickRatingReveal) {
      quickRatingReveal.hidden = false;
      GithubFeedback.renderQuickRating(quickRatingReveal, {
        gameId: "naeher",
        gameName: "Wer ist näher dran?",
        categoryLabel: "Gesamtspiel",
        word: currentQuestion.word
      });
    }
  }

  function renderRulerPins(results, targetVal, minVal, maxVal) {
    rulerTrack.innerHTML = "";
    rulerLabelMin.textContent = minVal;
    rulerLabelMax.textContent = maxVal;

    const range = maxVal - minVal || 100;

    // Helper to get percent left
    const getLeftPercent = (val) => {
      const p = ((val - minVal) / range) * 100;
      return Math.max(2, Math.min(98, p)); // clamp to avoid pins falling off track
    };

    // Render players pins
    results.forEach(res => {
      const pin = document.createElement("div");
      pin.className = "naeher-pin";
      pin.style.left = `${getLeftPercent(res.guess)}%`;
      // Get initials
      const initials = res.name.substring(0, 2).toUpperCase();
      pin.innerHTML = `
        <span class="naeher-pin-label">${initials}: ${res.guess}</span>
        <div class="naeher-pin-needle"></div>
      `;
      rulerTrack.appendChild(pin);
    });

    // Render correct answer pin
    const correctPin = document.createElement("div");
    correctPin.className = "naeher-pin naeher-pin--correct";
    correctPin.style.left = `${getLeftPercent(targetVal)}%`;
    correctPin.innerHTML = `
      <span class="naeher-pin-label">✓ ${targetVal}</span>
      <div class="naeher-pin-needle"></div>
    `;
    rulerTrack.appendChild(correctPin);
  }

  function renderRoundResultsList(results) {
    roundResultsList.innerHTML = "";
    results.forEach((res, index) => {
      const row = document.createElement("div");
      row.className = "naeher-result-row";
      row.style.animationDelay = `${index * 150}ms`;

      const devText = res.deviation === 0 ? "Exakt!" : `±${res.deviation}`;
      const bonusTag = res.exactMatch ? ' <span class="naeher-result-row__points bonus">🏆 Exakt-Bonus +500</span>' : "";

      row.innerHTML = `
        <div class="naeher-result-row__left">
          <div class="naeher-result-row__badge" style="background: var(--m3-primary-container); color: var(--m3-on-primary-container)">
            ${index + 1}
          </div>
          <div>
            <span class="naeher-result-row__name">${res.name}</span>
            <span class="naeher-result-row__guess">(Tipp: ${res.guess})</span>
          </div>
        </div>
        <div class="naeher-result-row__right">
          <span class="naeher-result-row__deviation" style="color: ${res.deviation === 0 ? '#2e7d32' : 'var(--m3-error)'}">${devText}</span>
          <span class="naeher-result-row__points">+${res.points} P.${bonusTag}</span>
        </div>
      `;
      roundResultsList.appendChild(row);
    });
  }

  btnRestartGame.addEventListener("click", () => {
    startNextRound();
  });

  btnExitToHome.addEventListener("click", () => {
    stopGame();
    ViewNav.transition(playView, setupView);
  });

  /* ------------------------------------------------------------------ */
  /* Teardown / Backbutton Confirmation                                 */
  /* ------------------------------------------------------------------ */
  startButton.addEventListener("click", startRound);

  function stopGame() {
    isGameActive = false;
  }

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
      if (isGameActive) {
        ConfirmDialog.show({
          title: "Spiel verlassen?",
          message: "Das laufende Duell wird abgebrochen.",
          confirmLabel: "Verlassen",
          onConfirm: () => {
            stopGame();
            ViewNav.transition(playView, setupView);
          }
        });
        return;
      }
      ViewNav.transition(playView, setupView);
      return;
    }
    if (!categorySelectView.hidden || !playerSelectView.hidden) {
      ViewNav.transition(categorySelectView.hidden ? playerSelectView : categorySelectView, setupView);
      return;
    }
    PageTransition.navigate("/");
  });

  // Android Back Gesture hook
  window.confirmGameExit = function () {
    if (isGameActive) {
      return confirm("Möchtest du das laufende Schätzduell wirklich beenden?");
    }
    return true;
  };

  playView.addEventListener("viewhide", stopGame);
  window.addEventListener("beforeunload", stopGame, { signal: Router.signal });
  Router.onTeardown(stopGame);
})();
