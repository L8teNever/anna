/**
 * Tickende Bombe – klassisches "Pass das Handy weiter"-Spiel.
 * Die Zündzeit ist zufällig zwischen min/max Sekunden und wird bewusst nie
 * angezeigt: das Ticken wird nur hörbar/fühlbar schneller, bis es knallt.
 */
(function () {
  const SETTINGS_KEY = "anna:bombe:settings";

  const setupView = document.getElementById("setup-view");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const playerNameInput = document.getElementById("player-name-input");
  const addPlayerButton = document.getElementById("add-player-button");
  const playerChips = document.getElementById("player-chips");

  const minSecondsInput = document.getElementById("min-seconds-input");
  const maxSecondsInput = document.getElementById("max-seconds-input");
  const startButton = document.getElementById("start-button");

  const bombRing = document.getElementById("bomb-ring");
  const bombIcon = document.getElementById("bomb-icon");
  const playStatus = document.getElementById("play-status");
  const playActions = document.getElementById("play-actions");
  const restartButton = document.getElementById("restart-button");
  const exitButton = document.getElementById("exit-button");

  let players = Storage.getPlayers("bombe");
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

  function renderPlayers() {
    playerChips.innerHTML = "";
    players.forEach((name, index) => {
      const chip = document.createElement("span");
      chip.className = "m3-chip";
      chip.innerHTML = `${name} <button type="button" class="m3-chip__remove" aria-label="${name} entfernen">✕</button>`;
      chip.querySelector(".m3-chip__remove").addEventListener("click", () => {
        players.splice(index, 1);
        Storage.setPlayers("bombe", players);
        renderPlayers();
      });
      playerChips.appendChild(chip);
    });
  }

  function addPlayer() {
    const name = playerNameInput.value.trim();
    if (!name) return;
    players.push(name);
    Storage.setPlayers("bombe", players);
    playerNameInput.value = "";
    renderPlayers();
    playerNameInput.focus();
  }

  addPlayerButton.addEventListener("click", addPlayer);
  playerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addPlayer();
    }
  });

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
    bombIcon.textContent = "💣";
    playStatus.textContent = "Gib das Handy weiter…";
    playStatus.dataset.exploded = "false";

    Sound.unlock();
    WakeLock.enable();
    scheduleTick(totalMs, performance.now());
  }

  function explode() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);

    bombIcon.textContent = "💥";
    bombRing.classList.add("bomb-ring--exploded");
    playStatus.textContent = "BOOM! Die Bombe ist hochgegangen.";
    playStatus.dataset.exploded = "true";
    playActions.hidden = false;

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

  renderPlayers();
})();
