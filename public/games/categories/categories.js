/**
 * Kategorien – zeigt eine zufällige Kategorie + einen zufälligen Buchstaben,
 * die Gruppe muss laut etwas Passendes finden, bevor der Timer abläuft.
 */
(function () {
  const SETTINGS_KEY = "anna:categories:settings";

  // Kategorienliste kommt aus categories.json (liegt neben dieser Datei).
  // Neue Kategorie = einfach neuen String in die JSON-Liste eintragen,
  // kein Code-Wissen nötig – wird beim nächsten Laden automatisch benutzt.
  const CATEGORIES_URL = "/games/categories/categories.json";
  let CATEGORY_POOL = [];
  const LETTER_POOL = "ABCDEFGHIJKLMNOPRSTW".split("");

  async function loadCategoryPool() {
    try {
      const response = await fetch(CATEGORIES_URL, { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data) && data.length) CATEGORY_POOL = data;
    } catch (err) {
      CATEGORY_POOL = [];
    }
  }
  loadCategoryPool();

  const MIN_PLAYERS = 1;

  const setupView = document.getElementById("setup-view");
  const playerSelectView = document.getElementById("view-player-select");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const secondsInput = document.getElementById("seconds-input");
  const startButton = document.getElementById("start-button");

  const catName = document.getElementById("cat-name");
  const catLetter = document.getElementById("cat-letter");
  const catTimer = document.getElementById("cat-timer");
  const nextRoundBar = document.getElementById("next-round-bar");
  const nextRoundButton = document.getElementById("next-round-button");
  const exitButton = document.getElementById("exit-button");

  const playerSummary = document.getElementById("player-select-summary");
  const openPlayerSelectBtn = document.getElementById("open-player-select-button");
  const playerBackButton = document.getElementById("player-select-back-button");
  const playerConfirmButton = document.getElementById("player-select-confirm-button");
  const validationWarning = document.getElementById("validation-warning");

  const playerPicker = PlayerPicker.create("categories");

  function updatePlayerSummary() {
    const count = playerPicker.getActiveCount();
    playerSummary.textContent = count === 1 ? "1 Spieler ausgewählt" : `${count} Spieler ausgewählt`;
    const valid = count >= MIN_PLAYERS;
    validationWarning.hidden = valid;
    startButton.disabled = !valid;
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  let intervalId = null;
  let remainingSeconds = 30;
  const circle = document.querySelector(".progress-ring__circle");
  const circumference = 2 * Math.PI * 52;
  let totalDuration = 30;

  if (circle) {
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = 0;
  }

  function updateProgress(remaining, total) {
    if (!circle) return;
    const progress = Math.max(0, Math.min(1, remaining / total));
    const offset = circumference - (progress * circumference);
    circle.style.strokeDashoffset = offset;

    if (remaining <= 5) {
      circle.setAttribute("stroke", "var(--m3-error)");
    } else {
      circle.setAttribute("stroke", "var(--m3-primary)");
    }
  }

  function loadSeconds() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}").seconds || 30;
    } catch (err) {
      return 30;
    }
  }

  function saveSeconds(seconds) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ seconds }));
  }

  secondsInput.value = loadSeconds();

  function stopTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function tickDown() {
    remainingSeconds -= 1;
    catTimer.textContent = String(remainingSeconds);
    catTimer.dataset.urgent = String(remainingSeconds <= 5 && remainingSeconds > 0);
    updateProgress(remainingSeconds, totalDuration);

    if (remainingSeconds <= 0) {
      stopTimer();
      Sound.success();
      if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(400);
      nextRoundBar.hidden = false;
      return;
    }
    Sound.tick(remainingSeconds <= 5 ? 1100 : 700);
  }

  function startRound() {
    const totalSeconds = Math.max(10, parseInt(secondsInput.value, 10) || 30);
    saveSeconds(totalSeconds);
    remainingSeconds = totalSeconds;
    totalDuration = totalSeconds;

    catName.textContent = CATEGORY_POOL.length
      ? CATEGORY_POOL[Math.floor(Math.random() * CATEGORY_POOL.length)]
      : "…";
    catLetter.textContent = LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
    catTimer.textContent = String(remainingSeconds);
    catTimer.dataset.urgent = "false";
    nextRoundBar.hidden = true;

    if (circle) {
      circle.style.strokeDashoffset = 0;
      circle.setAttribute("stroke", "var(--m3-primary)");
    }

    stopTimer();
    intervalId = setInterval(tickDown, 1000);
  }

  function stopGame() {
    stopTimer();
    WakeLock.disable();
  }

  startButton.addEventListener("click", () => {
    if (playerPicker.getActiveCount() < MIN_PLAYERS) return;
    setupView.hidden = true;
    playView.hidden = false;
    Sound.unlock();
    WakeLock.enable();
    startRound();
  });

  nextRoundButton.addEventListener("click", startRound);

  exitButton.addEventListener("click", () => {
    stopGame();
    window.location.href = "/";
  });

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
      stopGame();
      setupView.hidden = false;
      playView.hidden = true;
      return;
    }
    if (!playerSelectView.hidden && setupView.hidden) {
      ViewNav.transition(playerSelectView, setupView);
      return;
    }
    window.location.href = "/";
  });

  window.addEventListener("beforeunload", stopGame);
})();
