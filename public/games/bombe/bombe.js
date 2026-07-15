/**
 * Tickende Bombe – "Heiße Kartoffel"-Variante mit Kategorien.
 *
 * Spielprinzip:
 *   Beim Rundenstart wird eine zufällige Kategorie aus den gewählten
 *   Kategorien gezogen und deutlich angezeigt. Jeder, der die Bombe
 *   hält, muss EINEN Begriff aus dieser Kategorie nennen, bevor er
 *   weiterzugibt. Wer die Bombe hält, wenn sie explodiert, hat verloren.
 */
(function () {
  const SETTINGS_KEY = "anna:bombe:settings";
  const CATS_KEY     = "anna:bombe:categories";
  const MIN_PLAYERS  = 2;
  const MAX_PLAYERS  = 8;

  /* ------------------------------------------------------------------ */
  /* Kategorien-Datenbank: kommt aus categories.json (liegt neben dieser
   * Datei). Neue Kategorie = neues Objekt in der JSON-Liste anhängen.
   * Mehr Begriffe = einfach weitere Strings ins "words"-Array der
   * jeweiligen Kategorie eintragen. Kein Code-Wissen nötig.               */
  /* ------------------------------------------------------------------ */
  const CATEGORIES_URL = "/games/bombe/categories.json";
  let ALL_CATEGORIES = [];

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                        */
  /* ------------------------------------------------------------------ */
  const setupView          = document.getElementById("setup-view");
  const categorySelectView = document.getElementById("view-category-select");
  const playerSelectView   = document.getElementById("view-player-select");
  const playView           = document.getElementById("play-view");
  const backButton         = document.getElementById("back-button");

  const minSecondsInput = document.getElementById("min-seconds-input");
  const maxSecondsInput = document.getElementById("max-seconds-input");
  const startButton     = document.getElementById("start-button");

  const bombRing        = document.getElementById("bomb-ring");
  const bombIcon        = document.getElementById("bomb-icon");
  const bombIconUse     = bombIcon.querySelector("use");
  const playStatus      = document.getElementById("play-status");
  const playActions     = document.getElementById("play-actions");
  const restartButton   = document.getElementById("restart-button");
  const exitButton      = document.getElementById("exit-button");

  const categoriesPool       = document.getElementById("categories-pool");
  const categorySummary      = document.getElementById("category-select-summary");
  const openCategorySelectBtn = document.getElementById("open-category-select-button");
  const categoryBackButton    = document.getElementById("category-select-back-button");
  const categoryConfirmButton = document.getElementById("category-select-confirm-button");
  const categoryBulkAllBtn    = document.getElementById("category-bulk-all");
  const categoryBulkNoneBtn   = document.getElementById("category-bulk-none");

  const playerSummary        = document.getElementById("player-select-summary");
  const openPlayerSelectBtn  = document.getElementById("open-player-select-button");
  const playerBackButton     = document.getElementById("player-select-back-button");
  const playerConfirmButton  = document.getElementById("player-select-confirm-button");

  const validationWarning     = document.getElementById("validation-warning");
  const validationWarningText = document.getElementById("validation-warning-text");

  // Aktive Kategorieanzeige im Spielfeld
  const activeCatBadge  = document.getElementById("active-cat-badge");
  const activeCatText   = document.getElementById("active-cat-text");
  const activeCatExample = document.getElementById("active-cat-example");

  const playerPicker = PlayerPicker.create("bombe");
  let tickTimeoutId  = null;
  let roundActive    = false;

  /* ------------------------------------------------------------------ */
  /* Einstellungen laden / speichern                                      */
  /* ------------------------------------------------------------------ */
  function loadFuseSettings() {
    try { return Object.assign({ min: 30, max: 90 }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
    catch { return { min: 30, max: 90 }; }
  }
  function saveFuseSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  function loadSelectedCats() {
    try {
      const stored = JSON.parse(localStorage.getItem(CATS_KEY));
      if (Array.isArray(stored) && stored.length) return new Set(stored);
    } catch {}
    // Standard: alle aktiv
    return new Set(ALL_CATEGORIES.map((c) => c.id));
  }
  function saveSelectedCats(set) { localStorage.setItem(CATS_KEY, JSON.stringify([...set])); }

  const fuseSettings = loadFuseSettings();
  let selectedCats   = new Set();

  minSecondsInput.value = fuseSettings.min;
  maxSecondsInput.value = fuseSettings.max;

  /* ------------------------------------------------------------------ */
  /* Kategorie-Liste (Vollbild-Ansicht) aufbauen                          */
  /* ------------------------------------------------------------------ */
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
          <span class="category-row__desc">${cat.desc} · ${wordCount} Begriffe</span>
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

  /* ------------------------------------------------------------------ */
  /* Ansichten wechseln                                                    */
  /* ------------------------------------------------------------------ */
  openCategorySelectBtn.addEventListener("click", () => {
    renderCategoriesPool();
    ViewNav.transition(setupView, categorySelectView);
  });
  categoryBackButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));
  categoryConfirmButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));

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

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Zufällige Kategorie für diese Runde ziehen                          */
  /* ------------------------------------------------------------------ */
  function pickCategory() {
    const active = ALL_CATEGORIES.filter((c) => selectedCats.has(c.id));
    if (!active.length) return null;
    const cat = active[Math.floor(Math.random() * active.length)];
    const words = Array.isArray(cat.words) ? cat.words : [];
    const word = words.length ? words[Math.floor(Math.random() * words.length)] : null;
    return { ...cat, word };
  }

  /* ------------------------------------------------------------------ */
  /* Tick-Logik                                                           */
  /* ------------------------------------------------------------------ */
  function currentFuseRange() {
    let min = Math.max(5, parseInt(minSecondsInput.value, 10) || 30);
    let max = Math.max(5, parseInt(maxSecondsInput.value, 10) || 90);
    if (max < min) [min, max] = [max, min];
    saveFuseSettings({ min, max });
    return { min, max };
  }

  function pulse() {
    bombRing.classList.remove("bomb-ring--pulse");
    void bombRing.offsetWidth;
    bombRing.classList.add("bomb-ring--pulse");
  }

  function scheduleTick(totalMs, startedAt) {
    const remaining = totalMs - (performance.now() - startedAt);
    if (remaining <= 0) { explode(); return; }
    const progress = remaining / totalMs;
    const interval = 150 + 750 * Math.pow(progress, 1.4);
    tickTimeoutId = setTimeout(() => {
      if (!roundActive) return;
      pulse();
      Sound.tick(700 + 500 * (1 - progress));
      scheduleTick(totalMs, startedAt);
    }, interval);
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Steuerung                                                     */
  /* ------------------------------------------------------------------ */
  function startRound() {
    if (playerPicker.getActiveCount() < MIN_PLAYERS || playerPicker.getActiveCount() > MAX_PLAYERS) return;

    const { min, max } = currentFuseRange();
    const totalMs = (min + Math.random() * (max - min)) * 1000;

    roundActive = true;
    setupView.hidden = true;
    playView.hidden  = false;
    playActions.hidden = true;

    bombRing.classList.remove("bomb-ring--exploded");
    bombIconUse.setAttribute("href", "#icon-bomb");
    playStatus.dataset.exploded = "false";

    // Kategorie ziehen und anzeigen
    const cat = pickCategory();
    if (cat && activeCatBadge) {
      activeCatText.textContent = `${cat.icon}  ${cat.label}`;
      if (activeCatExample) {
        activeCatExample.hidden = !cat.word;
        if (cat.word) activeCatExample.textContent = `z.B. ${cat.word}`;
      }
      activeCatBadge.hidden = false;
      // Slide-in Animation neu starten
      activeCatBadge.classList.remove("active-cat--in");
      void activeCatBadge.offsetWidth;
      activeCatBadge.classList.add("active-cat--in");
    } else if (activeCatBadge) {
      activeCatBadge.hidden = true;
    }

    Sound.unlock();
    WakeLock.enable();

    const selectedNames = playerPicker.getSelectedNames();
    if (selectedNames.length > 0) {
      const starter = selectedNames[Math.floor(Math.random() * selectedNames.length)];
      playStatus.textContent = `${starter} fängt an – nenn einen Begriff, dann weiterreichen!`;
      Sound.say(`${starter} fängt an`);
    } else {
      playStatus.textContent = "Nenn einen Begriff aus der Kategorie, dann weiterreichen!";
    }

    scheduleTick(totalMs, performance.now());
  }

  function explode() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);

    bombIconUse.setAttribute("href", "#icon-burst");
    bombRing.classList.add("bomb-ring--exploded");
    playStatus.textContent = "💥 BOOM! Die Bombe ist hochgegangen.";
    playStatus.dataset.exploded = "true";
    playActions.hidden = false;

    // Screen Shake
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 500);

    // Fullscreen Flash
    const flash = document.createElement("div");
    flash.className = "explosion-flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);

    Sound.boom();
    if (Storage.getSettings().vibrationEnabled && navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 500]);
    }
    WakeLock.disable();
  }

  function stopRound() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);
    WakeLock.disable();
  }

  /* ------------------------------------------------------------------ */
  /* Event-Listener                                                        */
  /* ------------------------------------------------------------------ */
  startButton.addEventListener("click", startRound);
  restartButton.addEventListener("click", startRound);
  exitButton.addEventListener("click", () => { stopRound(); window.location.href = "/"; });
  backButton.addEventListener("click", () => {
    stopRound();
    if (!playView.hidden && setupView.hidden) {
      setupView.hidden = false;
      playView.hidden  = true;
      return;
    }
    if (!categorySelectView.hidden || !playerSelectView.hidden) {
      ViewNav.transition(categorySelectView.hidden ? playerSelectView : categorySelectView, setupView);
      return;
    }
    window.location.href = "/";
  });
  window.addEventListener("beforeunload", stopRound);
})();
