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

  /* ------------------------------------------------------------------ */
  /* Kategorien-Datenbank (nur Namen, keine Aufgaben)                    */
  /* ------------------------------------------------------------------ */
  const ALL_CATEGORIES = [
    { id: "automarken",   label: "Automarken",          icon: "🚗" },
    { id: "tiere",        label: "Tiere",               icon: "🐾" },
    { id: "laender",      label: "Länder",              icon: "🌍" },
    { id: "staedte",      label: "Städte",              icon: "🏙️" },
    { id: "sportarten",   label: "Sportarten",          icon: "⚽" },
    { id: "essen",        label: "Essen & Trinken",     icon: "🍕" },
    { id: "filme",        label: "Filmtitel",           icon: "🎬" },
    { id: "serien",       label: "Serien",              icon: "📺" },
    { id: "musiker",      label: "Musiker & Bands",     icon: "🎵" },
    { id: "instrumente",  label: "Musikinstrumente",    icon: "🎸" },
    { id: "berufe",       label: "Berufe",              icon: "💼" },
    { id: "videospiele",  label: "Videospiele",         icon: "🎮" },
    { id: "suesswaren",   label: "Süßigkeiten",         icon: "🍬" },
    { id: "urlaubsziele", label: "Urlaubsziele",        icon: "🏖️" },
    { id: "superstars",   label: "Prominente",          icon: "⭐" },
    { id: "pflanzungen",  label: "Pflanzen & Blumen",   icon: "🌺" },
    { id: "marken",       label: "Marken & Firmen",     icon: "🏷️" },
    { id: "farben",       label: "Dinge einer Farbe",   icon: "🎨" },
  ];

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                        */
  /* ------------------------------------------------------------------ */
  const setupView       = document.getElementById("setup-view");
  const playView        = document.getElementById("play-view");
  const backButton      = document.getElementById("back-button");

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

  const categoryPicker  = document.getElementById("category-picker");

  // Aktive Kategorieanzeige im Spielfeld
  const activeCatBadge  = document.getElementById("active-cat-badge");
  const activeCatText   = document.getElementById("active-cat-text");

  const playerPicker = PlayerPicker.create(document.getElementById("player-picker"), "bombe");
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
  let selectedCats   = loadSelectedCats();

  minSecondsInput.value = fuseSettings.min;
  maxSecondsInput.value = fuseSettings.max;

  /* ------------------------------------------------------------------ */
  /* Kategorie-Chip-Picker aufbauen                                        */
  /* ------------------------------------------------------------------ */
  function buildCategoryPicker() {
    categoryPicker.innerHTML = "";

    // "Alle" / "Keine" Schnell-Buttons
    const toolbar = document.createElement("div");
    toolbar.className = "bombe-cat-toolbar";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "Alle";
    allBtn.className = "bombe-cat-quick";
    allBtn.addEventListener("click", () => {
      selectedCats = new Set(ALL_CATEGORIES.map((c) => c.id));
      saveSelectedCats(selectedCats);
      updateChips();
    });

    const noneBtn = document.createElement("button");
    noneBtn.type = "button";
    noneBtn.textContent = "Keine";
    noneBtn.className = "bombe-cat-quick";
    noneBtn.addEventListener("click", () => {
      selectedCats = new Set();
      saveSelectedCats(selectedCats);
      updateChips();
    });

    toolbar.append(allBtn, noneBtn);
    categoryPicker.appendChild(toolbar);

    // Chips
    const grid = document.createElement("div");
    grid.className = "bombe-cat-chips";
    categoryPicker.appendChild(grid);

    ALL_CATEGORIES.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "bombe-cat-chip";
      chip.dataset.id = cat.id;
      chip.innerHTML = `<span class="bombe-cat-chip__icon">${cat.icon}</span>${cat.label}`;
      chip.setAttribute("aria-pressed", selectedCats.has(cat.id) ? "true" : "false");
      if (selectedCats.has(cat.id)) chip.classList.add("bombe-cat-chip--active");

      chip.addEventListener("click", () => {
        const active = chip.classList.toggle("bombe-cat-chip--active");
        chip.setAttribute("aria-pressed", active ? "true" : "false");
        if (active) selectedCats.add(cat.id);
        else        selectedCats.delete(cat.id);
        saveSelectedCats(selectedCats);
      });

      grid.appendChild(chip);
    });
  }

  function updateChips() {
    categoryPicker.querySelectorAll(".bombe-cat-chip").forEach((chip) => {
      const active = selectedCats.has(chip.dataset.id);
      chip.classList.toggle("bombe-cat-chip--active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  buildCategoryPicker();

  /* ------------------------------------------------------------------ */
  /* Zufällige Kategorie für diese Runde ziehen                          */
  /* ------------------------------------------------------------------ */
  function pickCategory() {
    const active = ALL_CATEGORIES.filter((c) => selectedCats.has(c.id));
    if (!active.length) return null;
    return active[Math.floor(Math.random() * active.length)];
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
    window.location.href = "/";
  });
  window.addEventListener("beforeunload", stopRound);
})();
