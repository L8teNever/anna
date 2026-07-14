/**
 * Wahrheit oder Pflicht – Spieler sind reihum an der Reihe, wählen
 * Wahrheit oder Pflicht und bekommen eine zufällige Aufgabe aus dem
 * jeweiligen Fragen-/Aufgaben-Pool (abhängig vom gewählten Modus).
 */
(function () {
  const PROMPTS = {
    normal: {
      truth: [
        "Was war dein peinlichster Moment in der Schule/Arbeit?",
        "Wen in dieser Runde würdest du am ehesten um Rat fragen?",
        "Was ist die größte Lüge, die du je erzählt hast?",
        "Worauf bist du am meisten stolz?",
        "Was ist dein größtes Laster?",
        "Wann hast du zuletzt geweint und warum?",
        "Was würdest du an dir selbst ändern, wenn du könntest?",
        "Welche App checkst du am häufigsten?",
        "Was ist das Peinlichste in deinem Suchverlauf?",
        "Wen in dieser Runde kennst du am wenigsten gut?",
      ],
      dare: [
        "Mach 10 Kniebeugen.",
        "Sprich für die nächsten zwei Runden nur im Flüsterton.",
        "Lass dir von jemandem ein Wort ins Gesicht schreiben (mit Finger, ohne Stift).",
        "Imitiere eine Person aus der Runde, bis sie erraten wird.",
        "Erzähle einen Witz – wenn keiner lacht, trinkst/isst du etwas.",
        "Tausche für eine Runde den Platz mit deinem Nachbarn.",
        "Singe die erste Zeile deines Lieblingssongs.",
        "Lass dich von der Gruppe für 30 Sekunden fotografieren, egal wie du aussiehst.",
        "Tanze 15 Sekunden ohne Musik.",
        "Rede die nächste Runde nur in Fragen.",
      ],
    },
    party: {
      truth: [
        "Wer in dieser Runde wäre dein Match bei einem Dating-App-Swipe?",
        "Was ist das Verrückteste, das du je auf einer Party gemacht hast?",
        "Hattest du schon mal ein Techtelmechtel mit jemandem aus dieser Runde?",
        "Was ist dein größtes Party-Bedauern?",
        "Wen in dieser Runde würdest du am ehesten daten?",
        "Was ist die peinlichste Nachricht, die du je verschickt hast?",
        "Welche Person hier würdest du am ehesten in einem Escape Room mitnehmen – oder eher nicht?",
        "Was war dein schlimmster Filmriss?",
      ],
      dare: [
        "Lass dir von der Gruppe ein Kompliment machen – und bedanke dich übertrieben theatralisch.",
        "Mach ein spontanes 10-Sekunden-Comedy-Set.",
        "Ruf/schreib jemandem eine ehrliche Nachricht, die die Gruppe diktiert (harmlos!).",
        "Tanze mit der Person rechts von dir 20 Sekunden.",
        "Lass dir von der Gruppe eine peinliche Frisur machen für den Rest der Runde.",
        "Mach 3 Runden lang jeden Trinkspruch mit Akzent.",
        "Zeig dein letztes Selfie in der Runde.",
        "Lass jemanden aus der Gruppe deinen Status auf dem Handy für eine Minute ändern.",
      ],
    },
  };

  const setupView = document.getElementById("setup-view");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const playerNameInput = document.getElementById("player-name-input");
  const addPlayerButton = document.getElementById("add-player-button");
  const playerChips = document.getElementById("player-chips");
  const modeSegmented = document.getElementById("mode-segmented");
  const startButton = document.getElementById("start-button");

  const turnName = document.getElementById("turn-name");
  const tdPlaceholder = document.getElementById("td-placeholder");
  const tdPrompt = document.getElementById("td-prompt");
  const choiceRow = document.getElementById("td-choice-row");
  const truthButton = document.getElementById("truth-button");
  const dareButton = document.getElementById("dare-button");
  const nextTurnBar = document.getElementById("next-turn-bar");
  const nextTurnButton = document.getElementById("next-turn-button");

  let players = Storage.getPlayers("truth_dare");
  let mode = "normal";
  let currentPlayerIndex = 0;
  const usedPrompts = new Set();

  function renderPlayers() {
    playerChips.innerHTML = "";
    players.forEach((name, index) => {
      const chip = document.createElement("span");
      chip.className = "m3-chip";
      chip.innerHTML = `${name} <button type="button" class="m3-chip__remove" aria-label="${name} entfernen">✕</button>`;
      chip.querySelector(".m3-chip__remove").addEventListener("click", () => {
        players.splice(index, 1);
        Storage.setPlayers("truth_dare", players);
        renderPlayers();
      });
      playerChips.appendChild(chip);
    });
  }

  function addPlayer() {
    const name = playerNameInput.value.trim();
    if (!name) return;
    players.push(name);
    Storage.setPlayers("truth_dare", players);
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
  }

  function pickPrompt(type) {
    const pool = PROMPTS[mode][type];
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
  }

  truthButton.addEventListener("click", () => reveal("truth"));
  dareButton.addEventListener("click", () => reveal("dare"));

  nextTurnButton.addEventListener("click", () => {
    currentPlayerIndex += 1;
    turnName.textContent = currentPlayerName();
    resetCard();
  });

  startButton.addEventListener("click", () => {
    currentPlayerIndex = 0;
    turnName.textContent = currentPlayerName();
    resetCard();
    setupView.hidden = true;
    playView.hidden = false;
  });

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
      setupView.hidden = false;
      playView.hidden = true;
      return;
    }
    window.location.href = "/";
  });

  renderPlayers();
})();
