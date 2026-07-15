/**
 * Wahrheit oder Pflicht – Spieler sind reihum an der Reihe, wählen
 * Wahrheit oder Pflicht und bekommen eine zufällige Aufgabe aus dem
 * jeweiligen Fragen-/Aufgaben-Pool (abhängig vom gewählten Modus).
 */
(function () {
  // Fragen-/Aufgaben-Pools kommen aus prompts.json (liegt neben dieser
  // Datei). Neue Frage/Aufgabe = einfach neuen String im passenden
  // "truth"- oder "dare"-Array eintragen, kein Code-Wissen nötig.
  const PROMPTS_URL = "/games/truth_dare/prompts.json";
  let PROMPTS = { normal: { truth: [], dare: [] }, party: { truth: [], dare: [] } };

  async function loadPrompts() {
    try {
      const response = await fetch(PROMPTS_URL, { cache: "no-store" });
      const data = await response.json();
      if (data && typeof data === "object") PROMPTS = data;
    } catch (err) {
      // PROMPTS bleibt beim leeren Fallback-Grundgerüst; pickPrompt()
      // fängt das unten ab, damit die Buttons nicht kaputtgehen.
    }
  }
  loadPrompts();

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 12;

  const setupView = document.getElementById("setup-view");
  const playerSelectView = document.getElementById("view-player-select");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const modeSegmented = document.getElementById("mode-segmented");
  const startButton = document.getElementById("start-button");

  const turnName = document.getElementById("turn-name");
  const tdCard = document.getElementById("td-card");
  const tdPlaceholder = document.getElementById("td-placeholder");
  const tdPrompt = document.getElementById("td-prompt");
  const choiceRow = document.getElementById("td-choice-row");
  const truthButton = document.getElementById("truth-button");
  const dareButton = document.getElementById("dare-button");
  const nextTurnBar = document.getElementById("next-turn-bar");
  const nextTurnButton = document.getElementById("next-turn-button");

  const playerSummary = document.getElementById("player-select-summary");
  const openPlayerSelectBtn = document.getElementById("open-player-select-button");
  const playerBackButton = document.getElementById("player-select-back-button");
  const playerConfirmButton = document.getElementById("player-select-confirm-button");
  const validationWarning = document.getElementById("validation-warning");
  const validationWarningText = document.getElementById("validation-warning-text");

  const playerPicker = PlayerPicker.create("truth_dare");
  let players = [];
  let mode = "normal";
  let currentPlayerIndex = 0;
  const usedPrompts = new Set();

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
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  modeSegmented.addEventListener("click", (event) => {
    const button = event.target.closest(".m3-segmented__option");
    if (!button) return;
    mode = button.dataset.value;
    modeSegmented.querySelectorAll(".m3-segmented__option").forEach((el) => {
      el.setAttribute("aria-pressed", String(el === button));
    });
  });
  modeSegmented.querySelector('[data-value="normal"]').setAttribute("aria-pressed", "true");

  function currentPlayerName() {
    if (players.length === 0) return "Spieler";
    return players[currentPlayerIndex % players.length];
  }

  function resetCard() {
    tdPlaceholder.hidden = false;
    tdPrompt.hidden = true;
    choiceRow.hidden = false;
    nextTurnBar.hidden = true;
    if (tdCard) {
      tdCard.classList.remove("card-deal");
    }
  }

  function pickPrompt(type) {
    const pool = (PROMPTS[mode] && PROMPTS[mode][type]) || [];
    if (!pool.length) return "…";
    const available = pool.filter((_, idx) => !usedPrompts.has(`${mode}:${type}:${idx}`));
    let index;
    if (available.length > 0) {
      index = pool.indexOf(available[Math.floor(Math.random() * available.length)]);
    } else {
      usedPrompts.clear();
      index = Math.floor(Math.random() * pool.length);
    }
    usedPrompts.add(`${mode}:${type}:${index}`);
    return pool[index];
  }

  function reveal(type) {
    tdPlaceholder.hidden = true;
    tdPrompt.hidden = false;
    tdPrompt.textContent = pickPrompt(type);
    choiceRow.hidden = true;
    nextTurnBar.hidden = false;

    // Trigger dealt card animation
    if (tdCard) {
      tdCard.classList.remove("card-deal");
      void tdCard.offsetWidth; // Reflow
      tdCard.classList.add("card-deal");
    }
  }

  truthButton.addEventListener("click", () => reveal("truth"));
  dareButton.addEventListener("click", () => reveal("dare"));

  nextTurnButton.addEventListener("click", () => {
    currentPlayerIndex += 1;
    turnName.textContent = currentPlayerName();
    resetCard();
  });

  startButton.addEventListener("click", () => {
    const count = playerPicker.getActiveCount();
    if (count < MIN_PLAYERS || count > MAX_PLAYERS) return;

    players = playerPicker.getSelectedNames();
    currentPlayerIndex = players.length > 0 ? Math.floor(Math.random() * players.length) : 0;
    turnName.textContent = currentPlayerName();
    resetCard();
    setupView.hidden = true;
    playView.hidden = false;

    if (players.length > 0) Sound.say(`${currentPlayerName()} fängt an`);
  });

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
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
})();
