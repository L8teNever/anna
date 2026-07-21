/**
 * Impostor – alle Mitspieler außer dem/den Impostor(en) sehen ein
 * gemeinsames Geheimwort (per Gedrückt-halten-Karte, einer nach dem
 * anderen). Danach beschreibt reihum jeder das Wort, ohne es zu sagen -
 * der Impostor muss mitreden, ohne aufzufliegen. Die eigentliche
 * Diskussion/Abstimmung läuft verbal, die App übernimmt nur die geheime
 * Wortvergabe.
 */
(function () {
  const SETTINGS_KEY = "anna:impostor:settings";
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 12;

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                        */
  /* ------------------------------------------------------------------ */
  const setupView = document.getElementById("setup-view");
  const categorySelectView = document.getElementById("view-category-select");
  const playerSelectView = document.getElementById("view-player-select");
  const revealView = document.getElementById("view-reveal");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const impostorCountValue = document.getElementById("impostor-count-value");
  const impostorCountMinus = document.getElementById("impostor-count-minus");
  const impostorCountPlus = document.getElementById("impostor-count-plus");
  const hintWordToggle = document.getElementById("hint-word-toggle");
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

  const revealPlayerName = document.getElementById("reveal-player-name");
  const revealProgress = document.getElementById("reveal-progress");
  const revealCard = document.getElementById("reveal-card");
  const revealCardFront = document.getElementById("reveal-card-front");
  const revealCardBack = document.getElementById("reveal-card-back");
  const revealRole = document.getElementById("reveal-role");
  const revealWord = document.getElementById("reveal-word");
  const revealExplainButton = document.getElementById("reveal-explain-button");
  const revealDescription = document.getElementById("reveal-description");
  const revealNextButton = document.getElementById("reveal-next-button");

  const restartButton = document.getElementById("restart-button");
  const exitButton = document.getElementById("exit-button");
  const quickRatingEl = document.getElementById("quick-rating");

  const playerPicker = PlayerPicker.create();
  const categoryPicker = CategoryPicker.create("impostor", "/games/impostor/categories.json");

  /* ------------------------------------------------------------------ */
  /* Einstellungen laden / speichern                                      */
  /* ------------------------------------------------------------------ */
  function loadSettings() {
    try {
      return Object.assign({ impostorCount: 1, hintWordEnabled: false }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
    } catch {
      return { impostorCount: 1, hintWordEnabled: false };
    }
  }
  function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  const settings = loadSettings();
  let impostorCount = settings.impostorCount;
  hintWordToggle.checked = settings.hintWordEnabled;

  /* ------------------------------------------------------------------ */
  /* Ansichten wechseln                                                    */
  /* ------------------------------------------------------------------ */
  openCategorySelectBtn.addEventListener("click", () => ViewNav.transition(setupView, categorySelectView));
  categoryBackButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));
  categoryConfirmButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Mitspieler + Impostor-Anzahl                                         */
  /* ------------------------------------------------------------------ */
  function maxImpostorsFor(playerCount) {
    return Math.max(1, Math.min(playerCount - 1, 4));
  }

  function renderImpostorCount() {
    impostorCountValue.textContent = String(impostorCount);
    const count = playerPicker.getActiveCount();
    impostorCountMinus.disabled = impostorCount <= 1;
    impostorCountPlus.disabled = impostorCount >= maxImpostorsFor(Math.max(count, 2));
  }

  impostorCountMinus.addEventListener("click", () => {
    if (impostorCount <= 1) return;
    impostorCount -= 1;
    saveSettings({ impostorCount, hintWordEnabled: hintWordToggle.checked });
    renderImpostorCount();
  });

  impostorCountPlus.addEventListener("click", () => {
    const max = maxImpostorsFor(Math.max(playerPicker.getActiveCount(), 2));
    if (impostorCount >= max) return;
    impostorCount += 1;
    saveSettings({ impostorCount, hintWordEnabled: hintWordToggle.checked });
    renderImpostorCount();
  });

  hintWordToggle.addEventListener("change", () => {
    saveSettings({ impostorCount, hintWordEnabled: hintWordToggle.checked });
  });

  function updatePlayerSummary() {
    const count = playerPicker.getActiveCount();
    playerSummary.textContent = count === 1 ? "1 Spieler ausgewählt" : `${count} Spieler ausgewählt`;

    const valid = count >= MIN_PLAYERS && count <= MAX_PLAYERS;
    validationWarning.hidden = valid;
    if (!valid) {
      validationWarningText.textContent = count < MIN_PLAYERS
        ? `Mindestens ${MIN_PLAYERS} Mitspieler nötig (aktuell ${count}).`
        : `Höchstens ${MAX_PLAYERS} Mitspieler möglich (aktuell ${count}).`;
    }
    startButton.disabled = !valid;

    // Impostor-Anzahl darf nie >= Spieleranzahl sein.
    const max = maxImpostorsFor(Math.max(count, 2));
    if (impostorCount > max) {
      impostorCount = max;
      saveSettings({ impostorCount, hintWordEnabled: hintWordToggle.checked });
    }
    renderImpostorCount();
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Gedrückt-halten-Karte                                                 */
  /* ------------------------------------------------------------------ */
  function setupHoldReveal(cardEl, onPeek, onRelease) {
    let holding = false;

    function startHold(event) {
      if (holding) return;
      holding = true;
      cardEl.setPointerCapture(event.pointerId);
      onPeek();
    }

    function endHold() {
      if (!holding) return;
      holding = false;
      onRelease(true);
    }

    cardEl.addEventListener("pointerdown", startHold);
    cardEl.addEventListener("pointerup", endHold);
    cardEl.addEventListener("pointercancel", endHold);
    cardEl.addEventListener("pointerleave", endHold);
    cardEl.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Ablauf                                                        */
  /* ------------------------------------------------------------------ */
  let roundPlayers = [];
  let impostorIndices = new Set();
  let secretWord = "";
  let secretHint = null;
  let secretDescription = null;
  let hintCategoryLabel = null;
  let currentRevealIndex = 0;

  let revealAvatars = [
    "/assets/reveal_images/avatar_1.png",
    "/assets/reveal_images/avatar_2.png",
    "/assets/reveal_images/avatar_3.png",
    "/assets/reveal_images/avatar_4.png"
  ];
  let playerRevealAvatars = {};
  let avatarSeedOffset = 0;

  async function loadRevealAvatars() {
    try {
      const res = await fetch("/api/reveal-avatars");
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          revealAvatars = list;
        }
      }
    } catch (e) {
      console.warn("Could not load custom reveal avatars, using defaults:", e);
    }
  }
  loadRevealAvatars();

  function getPlayerRevealAvatar(name) {
    if (!name) {
      return revealAvatars[Math.floor(Math.random() * revealAvatars.length)];
    }
    if (!playerRevealAvatars[name]) {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash + avatarSeedOffset) % revealAvatars.length;
      playerRevealAvatars[name] = revealAvatars[index];
    }
    return playerRevealAvatars[name];
  }

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Eingebaute Kategorien (categories.json) liefern Wort-Objekte mit einem
  // pro Wort handverlesenen Hilfewort ({ word, hint, description? }) -
  // selbst angelegte Kategorien (siehe category-picker.js) speichern
  // dagegen nur schlichte Text-Strings, weil deren Erstellungsdialog kein
  // Hilfewort abfragt. Diese Funktion gleicht beide Formen an.
  function normalizeWordEntry(entry) {
    if (typeof entry === "string") return { word: entry, hint: null, description: null };
    return { word: entry.word, hint: entry.hint || null, description: entry.description || null };
  }

  function pickRoundWord() {
    const active = categoryPicker.getSelectedCategories().filter((c) => Array.isArray(c.words) && c.words.length);
    if (!active.length) return { word: null, hint: null, description: null, categoryLabel: null };
    const category = active[Math.floor(Math.random() * active.length)];
    const entry = normalizeWordEntry(category.words[Math.floor(Math.random() * category.words.length)]);
    return { word: entry.word, hint: entry.hint, description: entry.description, categoryLabel: category.label };
  }

  function showRevealForCurrentPlayer() {
    revealPlayerName.textContent = roundPlayers[currentRevealIndex];
    revealProgress.textContent = `${currentRevealIndex + 1} / ${roundPlayers.length}`;
    revealCard.classList.remove("reveal-card--revealed", "reveal-card--impostor");

    const imgEl = document.getElementById("reveal-card-image");
    if (imgEl) {
      imgEl.src = getPlayerRevealAvatar(roundPlayers[currentRevealIndex]);
    }
    
    const isImpostor = impostorIndices.has(currentRevealIndex);
    revealRole.classList.toggle("reveal-card__role--impostor", isImpostor);
    if (isImpostor) {
      revealRole.textContent = "Du bist der Impostor!";
      if (!hintWordToggle.checked) {
        revealWord.textContent = "Kein Wort – hör gut zu und bluffe mit!";
      } else if (secretHint) {
        // Handverlesenes Hilfewort aus categories.json - passt zum Wort,
        // ohne es direkt zu verraten (siehe normalizeWordEntry()).
        revealWord.textContent = `Hinweis: ${secretHint}`;
      } else {
        // Fallback für selbst angelegte Kategorien ohne Hilfewort pro Wort.
        revealWord.textContent = hintCategoryLabel
          ? `Hinweis: Kategorie „${hintCategoryLabel}“`
          : "Kein Wort – hör gut zu und bluffe mit!";
      }
    } else {
      revealRole.textContent = "Dein Wort:";
      revealWord.textContent = secretWord;
    }

    revealCardBack.hidden = false;
    revealCardFront.hidden = false;
    revealNextButton.hidden = true;
    revealExplainButton.hidden = true;
    revealDescription.hidden = true;
    revealDescription.textContent = "";
    delete revealCard.dataset.peeked;
    const hint = document.getElementById("reveal-card-hint");
    if (hint) hint.innerHTML = "Gedrückt halten,<br/>um dein Wort zu sehen";
  }

  function peekCurrentPlayer() {
    revealCard.classList.add("reveal-card--revealed");
    
    const isImpostor = impostorIndices.has(currentRevealIndex);
    revealCard.classList.toggle("reveal-card--impostor", isImpostor);

    if (!revealCard.dataset.peeked) {
      revealCard.dataset.peeked = "true";
      Sound.beep(720, 0.1);
      if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(30);
    }
  }

  function hideCurrentPlayer(finished) {
    revealCard.classList.remove("reveal-card--revealed", "reveal-card--impostor");

    if (finished || revealCard.dataset.peeked) {
      revealNextButton.hidden = false;
      const hint = document.getElementById("reveal-card-hint");
      if (hint) hint.innerHTML = "Erneut ansehen<br/>(gedrückt halten)";

      // Nur für Wort-Halter (nicht den Impostor) und nur, wenn der Begriff
      // tatsächlich eine Erklärung hat (z.B. unbekannte Spicy-Begriffe).
      const isImpostor = impostorIndices.has(currentRevealIndex);
      revealExplainButton.hidden = isImpostor || !secretDescription;
    }
  }

  revealExplainButton.addEventListener("click", () => {
    // Nur die Sichtbarkeit umschalten, NICHT .textContent des Buttons
    // setzen - das würde das darin enthaltene SVG-Icon mit löschen.
    if (revealDescription.hidden) {
      revealDescription.textContent = secretDescription || "";
      revealDescription.hidden = false;
    } else {
      revealDescription.hidden = true;
    }
  });

  setupHoldReveal(revealCard, peekCurrentPlayer, hideCurrentPlayer);

  revealNextButton.addEventListener("click", () => {
    currentRevealIndex += 1;
    if (currentRevealIndex < roundPlayers.length) {
      showRevealForCurrentPlayer();
    } else {
      ViewNav.transition(revealView, playView);
      if (quickRatingEl) {
        quickRatingEl.hidden = true;
        GithubFeedback.renderQuickRating(quickRatingEl, {
          gameId: "impostor",
          gameName: "Impostor",
          categoryLabel: hintCategoryLabel,
          word: secretWord,
        });
      }
    }
  });

  function beginRound() {
    // Bewusst NICHT gemischt: die Weitergabe-Reihenfolge richtet sich nach
    // der vom Spielerpicker vorgegebenen Reihenfolge (siehe player-picker.js
    // - Spieler lassen sich dort per Ziehen anordnen), damit das Gerät in
    // einer vorhersehbaren, real am Tisch nachvollziehbaren Reihenfolge
    // weitergereicht wird. Wer heimlich der Impostor ist, bleibt trotzdem
    // zufällig (siehe shuffledIdx unten).
    roundPlayers = playerPicker.getSelectedNames();
    const { word, hint, description, categoryLabel } = pickRoundWord();
    secretWord = word || "…";
    secretHint = hint;
    secretDescription = description;
    hintCategoryLabel = categoryLabel;
    playerRevealAvatars = {};
    avatarSeedOffset = Math.floor(Math.random() * revealAvatars.length);

    const impostorTotal = Math.min(impostorCount, Math.max(1, roundPlayers.length - 1));
    const shuffledIdx = shuffle(roundPlayers.map((_, idx) => idx));
    impostorIndices = new Set(shuffledIdx.slice(0, impostorTotal));

    currentRevealIndex = 0;
    ViewNav.transition(null, revealView);
    showRevealForCurrentPlayer();
  }

  startButton.addEventListener("click", () => {
    const count = playerPicker.getActiveCount();
    if (count < MIN_PLAYERS || count > MAX_PLAYERS) return;
    beginRound();
  });

  restartButton.addEventListener("click", beginRound);
  exitButton.addEventListener("click", () => { ViewNav.transition(playView, setupView); });

  backButton.addEventListener("click", () => {
    if (!revealView.hidden && setupView.hidden) {
      // Wortvergabe läuft gerade -> erst bestätigen lassen.
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die Wortvergabe wird abgebrochen.",
        confirmLabel: "Verlassen",
        onConfirm: () => ViewNav.transition(revealView, setupView),
      });
      return;
    }
    if (!playView.hidden && setupView.hidden) {
      // Diskussionsrunde läuft -> erst bestätigen lassen.
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die laufende Runde wird abgebrochen.",
        confirmLabel: "Verlassen",
        onConfirm: () => ViewNav.transition(playView, setupView),
      });
      return;
    }
    if (!categorySelectView.hidden || !playerSelectView.hidden) {
      ViewNav.transition(categorySelectView.hidden ? playerSelectView : categorySelectView, setupView);
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
    if (currentActive && (currentActive.id === "view-reveal" || currentActive.id === "play-view")) {
      return confirm("Möchtest du das laufende Spiel wirklich beenden?");
    }
    return true;
  };
})();
