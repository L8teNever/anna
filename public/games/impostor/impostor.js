/**
 * Impostor – alle Mitspieler außer dem/den Impostor(en) sehen ein
 * gemeinsames Geheimwort (per Wisch-nach-oben-Karte, einer nach dem
 * anderen). Danach beschreibt reihum jeder das Wort, ohne es zu sagen -
 * der Impostor muss mitreden, ohne aufzufliegen. Die eigentliche
 * Diskussion/Abstimmung läuft verbal, die App übernimmt nur die geheime
 * Wortvergabe.
 */
(function () {
  const SETTINGS_KEY = "anna:impostor:settings";
  const CATS_KEY = "anna:impostor:categories";
  const CATEGORIES_URL = "/games/impostor/categories.json";
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 12;

  let ALL_CATEGORIES = [];
  let selectedCats = new Set();

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

  const categoriesPool = document.getElementById("categories-pool");
  const categorySummary = document.getElementById("category-select-summary");
  const openCategorySelectBtn = document.getElementById("open-category-select-button");
  const categoryBackButton = document.getElementById("category-select-back-button");
  const categoryConfirmButton = document.getElementById("category-select-confirm-button");
  const categoryBulkAllBtn = document.getElementById("category-bulk-all");
  const categoryBulkNoneBtn = document.getElementById("category-bulk-none");

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
  const revealNextButton = document.getElementById("reveal-next-button");

  const restartButton = document.getElementById("restart-button");
  const exitButton = document.getElementById("exit-button");

  const playerPicker = PlayerPicker.create("impostor");

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
  /* Kategorien laden                                                      */
  /* ------------------------------------------------------------------ */
  function loadSelectedCats() {
    try {
      const stored = JSON.parse(localStorage.getItem(CATS_KEY));
      if (Array.isArray(stored) && stored.length) return new Set(stored);
    } catch {}
    return new Set(ALL_CATEGORIES.map((c) => c.id));
  }
  function saveSelectedCats(set) { localStorage.setItem(CATS_KEY, JSON.stringify([...set])); }

  function updateCategorySummary() {
    if (!categorySummary) return;
    if (!ALL_CATEGORIES.length) {
      categorySummary.textContent = "Kategorien werden geladen…";
    } else if (selectedCats.size === ALL_CATEGORIES.length) {
      categorySummary.textContent = "Alle Kategorien aktiv";
    } else if (selectedCats.size === 0) {
      categorySummary.textContent = "Keine Kategorie aktiv";
    } else {
      categorySummary.textContent = `${selectedCats.size} von ${ALL_CATEGORIES.length} aktiv`;
    }
  }

  function renderCategoriesPool() {
    categoriesPool.innerHTML = ALL_CATEGORIES.map((cat) => {
      const wordCount = Array.isArray(cat.words) ? cat.words.length : 0;
      return `
      <div class="category-row" data-id="${cat.id}">
        <div class="category-row__text">
          <span class="category-row__title">${cat.icon} ${cat.label}</span>
          <span class="category-row__desc">${cat.desc} · ${wordCount} Wörter</span>
        </div>
        <label class="m3-switch">
          <input type="checkbox" class="category-row__checkbox" ${selectedCats.has(cat.id) ? "checked" : ""} />
          <span class="m3-switch__track"></span>
        </label>
      </div>
    `;
    }).join("");
    updateCategorySummary();
  }

  categoriesPool.addEventListener("change", (event) => {
    const checkbox = event.target.closest(".category-row__checkbox");
    if (!checkbox) return;
    const id = checkbox.closest(".category-row").dataset.id;
    if (checkbox.checked) selectedCats.add(id);
    else selectedCats.delete(id);
    saveSelectedCats(selectedCats);
    updateCategorySummary();
  });

  categoryBulkAllBtn.addEventListener("click", () => {
    selectedCats = new Set(ALL_CATEGORIES.map((c) => c.id));
    saveSelectedCats(selectedCats);
    renderCategoriesPool();
  });

  categoryBulkNoneBtn.addEventListener("click", () => {
    selectedCats = new Set();
    saveSelectedCats(selectedCats);
    renderCategoriesPool();
  });

  async function initCategories() {
    try {
      const response = await fetch(CATEGORIES_URL, { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data)) ALL_CATEGORIES = data;
    } catch (err) {
      ALL_CATEGORIES = [];
    }
    selectedCats = loadSelectedCats();
    renderCategoriesPool();
  }
  initCategories();

  openCategorySelectBtn.addEventListener("click", () => {
    renderCategoriesPool();
    ViewNav.transition(setupView, categorySelectView);
  });
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
  /* Wisch-nach-oben-Karte                                                 */
  /* ------------------------------------------------------------------ */
  function setupSwipeReveal(cardEl, onReveal) {
    const THRESHOLD = 60;
    let dragging = false;
    let startY = 0;
    let deltaY = 0;

    function resetTransform() {
      cardEl.style.transform = "";
      cardEl.classList.remove("reveal-card--dragging");
    }

    function isRevealed() {
      return cardEl.classList.contains("reveal-card--revealed");
    }

    cardEl.addEventListener("pointerdown", (event) => {
      if (isRevealed()) return;
      dragging = true;
      startY = event.clientY;
      deltaY = 0;
      cardEl.classList.add("reveal-card--dragging");
      cardEl.setPointerCapture(event.pointerId);
    });

    cardEl.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      deltaY = Math.min(0, event.clientY - startY);
      cardEl.style.transform = `translateY(${deltaY}px)`;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(deltaY) > THRESHOLD) {
        onReveal();
      } else {
        resetTransform();
      }
      deltaY = 0;
    }

    cardEl.addEventListener("pointerup", endDrag);
    cardEl.addEventListener("pointercancel", endDrag);

    // Tippen als barrierefreie Alternative zum Wischen.
    cardEl.addEventListener("click", () => {
      if (!isRevealed() && !dragging) onReveal();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Ablauf                                                        */
  /* ------------------------------------------------------------------ */
  let roundPlayers = [];
  let impostorIndices = new Set();
  let secretWord = "";
  let hintWord = null;
  let currentRevealIndex = 0;

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickRoundWord() {
    const active = ALL_CATEGORIES.filter((c) => selectedCats.has(c.id) && Array.isArray(c.words) && c.words.length);
    if (!active.length) return { word: null, hint: null };
    const category = active[Math.floor(Math.random() * active.length)];
    const words = category.words;
    const word = words[Math.floor(Math.random() * words.length)];
    let hint = null;
    if (hintWordToggle.checked && words.length > 1) {
      const otherWords = words.filter((w) => w !== word);
      hint = otherWords[Math.floor(Math.random() * otherWords.length)];
    }
    return { word, hint };
  }

  function showRevealForCurrentPlayer() {
    revealPlayerName.textContent = roundPlayers[currentRevealIndex];
    revealProgress.textContent = `${currentRevealIndex + 1} / ${roundPlayers.length}`;
    revealCard.classList.remove("reveal-card--revealed", "reveal-card--impostor");
    revealCard.style.transform = "";
    revealCardFront.hidden = false;
    revealCardBack.hidden = true;
    revealNextButton.hidden = true;
  }

  function revealCurrentPlayer() {
    if (revealCard.classList.contains("reveal-card--revealed")) return;
    revealCard.classList.remove("reveal-card--dragging");
    revealCard.classList.add("reveal-card--revealed");
    revealCard.style.transform = "";
    revealCardFront.hidden = true;
    revealCardBack.hidden = false;

    const isImpostor = impostorIndices.has(currentRevealIndex);
    revealRole.classList.toggle("reveal-card__role--impostor", isImpostor);
    revealCard.classList.toggle("reveal-card--impostor", isImpostor);
    if (isImpostor) {
      revealRole.textContent = "Du bist der Impostor!";
      revealWord.textContent = hintWord ? `Hinweis: ${hintWord}` : "Kein Wort – hör gut zu und bluffe mit!";
    } else {
      revealRole.textContent = "Dein Wort:";
      revealWord.textContent = secretWord;
    }

    Sound.beep(720, 0.1);
    if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(30);

    revealNextButton.hidden = false;
  }

  setupSwipeReveal(revealCard, revealCurrentPlayer);

  revealNextButton.addEventListener("click", () => {
    currentRevealIndex += 1;
    if (currentRevealIndex < roundPlayers.length) {
      showRevealForCurrentPlayer();
    } else {
      revealView.hidden = true;
      playView.hidden = false;
    }
  });

  function beginRound() {
    roundPlayers = shuffle(playerPicker.getSelectedNames());
    const { word, hint } = pickRoundWord();
    secretWord = word || "…";
    hintWord = hint;

    const impostorTotal = Math.min(impostorCount, Math.max(1, roundPlayers.length - 1));
    const shuffledIdx = shuffle(roundPlayers.map((_, idx) => idx));
    impostorIndices = new Set(shuffledIdx.slice(0, impostorTotal));

    currentRevealIndex = 0;
    setupView.hidden = true;
    playView.hidden = true;
    revealView.hidden = false;
    showRevealForCurrentPlayer();
  }

  startButton.addEventListener("click", () => {
    const count = playerPicker.getActiveCount();
    if (count < MIN_PLAYERS || count > MAX_PLAYERS) return;
    beginRound();
  });

  restartButton.addEventListener("click", beginRound);
  exitButton.addEventListener("click", () => { window.location.href = "/"; });

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
      setupView.hidden = false;
      playView.hidden = true;
      return;
    }
    if (!revealView.hidden && setupView.hidden) {
      revealView.hidden = true;
      setupView.hidden = false;
      return;
    }
    if (!categorySelectView.hidden || !playerSelectView.hidden) {
      ViewNav.transition(categorySelectView.hidden ? playerSelectView : categorySelectView, setupView);
      return;
    }
    window.location.href = "/";
  });
})();
