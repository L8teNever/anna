/**
 * Tickende Bombe – klassisches "Pass das Handy weiter"-Spiel.
 * Die Zündzeit ist zufällig zwischen min/max Sekunden und wird bewusst nie
 * angezeigt: das Ticken wird nur hörbar/fühlbar schneller, bis es knallt.
 */
(function () {
  const SETTINGS_KEY = "anna:bombe:settings";
  const CATEGORY_SETTINGS_KEY = "anna:bombe:categories";

  const CATEGORY_LIST = [
    { id: "automarken", label: "Automarken", prompt: "Nenne eine Automarke" },
    { id: "staedte", label: "Städte", prompt: "Nenne eine Stadt" },
    { id: "tiere", label: "Tiere", prompt: "Nenne ein Tier" },
    { id: "filme", label: "Filme", prompt: "Nenne einen Filmtitel" },
    { id: "promis", label: "Promis", prompt: "Nenne einen Promi" },
    { id: "essen", label: "Essen & Trinken", prompt: "Nenne etwas zu essen oder zu trinken" },
    { id: "berufe", label: "Berufe", prompt: "Nenne einen Beruf" },
    { id: "farben", label: "Farben", prompt: "Nenne eine Farbe" },
    { id: "sportarten", label: "Sportarten", prompt: "Nenne eine Sportart" },
    { id: "vornamen", label: "Vornamen", prompt: "Nenne einen Vornamen" },
    { id: "marken", label: "Marken", prompt: "Nenne eine Marke" },
    { id: "musikbands", label: "Musikbands", prompt: "Nenne eine Musikband" },
  ];

  const setupView = document.getElementById("setup-view");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const minSecondsInput = document.getElementById("min-seconds-input");
  const maxSecondsInput = document.getElementById("max-seconds-input");
  const startButton = document.getElementById("start-button");
  const categoryPicker = document.getElementById("category-picker");

  const bombRing = document.getElementById("bomb-ring");
  const bombIcon = document.getElementById("bomb-icon");
  const bombIconUse = bombIcon.querySelector("use");
  const bombCategory = document.getElementById("bomb-category");
  const bombCategoryText = document.getElementById("bomb-category-text");
  const playStatus = document.getElementById("play-status");
  const playActions = document.getElementById("play-actions");
  const restartButton = document.getElementById("restart-button");
  const exitButton = document.getElementById("exit-button");

  const playerPicker = PlayerPicker.create(document.getElementById("player-picker"), "bombe");
  let tickTimeoutId = null;
  let roundActive = false;

  function loadFuseSettings() {
    try {
      return Object.assign({ min: 30, max: 90 }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
    } catch (err) {
      return { min: 30, max: 90 };
    }
  }

  function saveFuseSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  const fuseSettings = loadFuseSettings();
  minSecondsInput.value = fuseSettings.min;
  maxSecondsInput.value = fuseSettings.max;

  function currentFuseRange() {
    let min = Math.max(5, parseInt(minSecondsInput.value, 10) || 30);
    let max = Math.max(5, parseInt(maxSecondsInput.value, 10) || 90);
    if (max < min) [min, max] = [max, min];
    saveFuseSettings({ min, max });
    return { min, max };
  }

  function loadSelectedCategories() {
    try {
      const ids = JSON.parse(localStorage.getItem(CATEGORY_SETTINGS_KEY) || "[]");
      const validIds = new Set(CATEGORY_LIST.map((cat) => cat.id));
      return new Set(ids.filter((id) => validIds.has(id)));
    } catch (err) {
      return new Set();
    }
  }

  function saveSelectedCategories() {
    localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(Array.from(selectedCategories)));
  }

  const selectedCategories = loadSelectedCategories();

  function renderCategoryPicker() {
    categoryPicker.innerHTML = CATEGORY_LIST.map((cat) => {
      const active = selectedCategories.has(cat.id) ? " category-chip--active" : "";
      return `<button type="button" class="category-chip${active}" data-id="${cat.id}">${cat.label}</button>`;
    }).join("");
  }

  categoryPicker.addEventListener("click", (event) => {
    const chip = event.target.closest(".category-chip");
    if (!chip) return;
    const id = chip.dataset.id;
    if (selectedCategories.has(id)) selectedCategories.delete(id);
    else selectedCategories.add(id);
    saveSelectedCategories();
    renderCategoryPicker();
  });

  renderCategoryPicker();

  function pickCategory() {
    if (selectedCategories.size === 0) return null;
    const options = CATEGORY_LIST.filter((cat) => selectedCategories.has(cat.id));
    return options[Math.floor(Math.random() * options.length)];
  }

  function pulse() {
    bombRing.classList.remove("bomb-ring--pulse");
    // Reflow erzwingen, damit die Animation bei jedem Tick neu startet.
    void bombRing.offsetWidth;
    bombRing.classList.add("bomb-ring--pulse");
  }

  function scheduleTick(totalMs, startedAt) {
    const remaining = totalMs - (performance.now() - startedAt);
    if (remaining <= 0) {
      explode();
      return;
    }

    const progress = remaining / totalMs;
    const interval = 150 + 750 * Math.pow(progress, 1.4);

    tickTimeoutId = setTimeout(() => {
      if (!roundActive) return;
      pulse();
      Sound.tick(700 + 500 * (1 - progress));
      scheduleTick(totalMs, startedAt);
    }, interval);
  }

  function startRound() {
    const { min, max } = currentFuseRange();
    const totalSeconds = min + Math.random() * (max - min);
    const totalMs = totalSeconds * 1000;

    roundActive = true;
    setupView.hidden = true;
    playView.hidden = false;
    playActions.hidden = true;
    bombRing.classList.remove("bomb-ring--exploded");
    bombIconUse.setAttribute("href", "#icon-bomb");
    playStatus.dataset.exploded = "false";

    Sound.unlock();
    WakeLock.enable();

    const category = pickCategory();
    if (category) {
      bombCategoryText.textContent = category.label;
      bombCategory.hidden = false;
    } else {
      bombCategory.hidden = true;
    }

    const selectedNames = playerPicker.getSelectedNames();
    const starter = selectedNames.length > 0 ? selectedNames[Math.floor(Math.random() * selectedNames.length)] : null;

    const announcement = [starter ? `${starter} fängt an` : null, category ? category.prompt : null].filter(Boolean);
    playStatus.textContent = announcement.length > 0 ? `${announcement.join(" – ")} – gib dann weiter…` : "Gib das Handy weiter…";
    if (announcement.length > 0) Sound.say(announcement.join(". "));

    scheduleTick(totalMs, performance.now());
  }

  function explode() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);

    bombIconUse.setAttribute("href", "#icon-burst");
    bombRing.classList.add("bomb-ring--exploded");
    playStatus.textContent = "BOOM! Die Bombe ist hochgegangen.";
    playStatus.dataset.exploded = "true";
    playActions.hidden = false;

    // Trigger visual feedback: Screen Shake
    document.body.classList.add("shake");
    setTimeout(() => {
      document.body.classList.remove("shake");
    }, 500);

    // Trigger visual feedback: Fullscreen Explosion Flash
    const flash = document.createElement("div");
    flash.className = "explosion-flash";
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.remove();
    }, 600);

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

  startButton.addEventListener("click", startRound);
  restartButton.addEventListener("click", startRound);
  exitButton.addEventListener("click", () => {
    stopRound();
    window.location.href = "/";
  });
  backButton.addEventListener("click", () => {
    stopRound();
    if (!playView.hidden && setupView.hidden) {
      setupView.hidden = false;
      playView.hidden = true;
      return;
    }
    window.location.href = "/";
  });

  window.addEventListener("beforeunload", stopRound);
})();
