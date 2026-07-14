// Game Module: Wahrheit oder Pflicht

(function() {
  const TRUTHS = [
    "Was ist dein peinlichstes Erlebnis in der Schule/Arbeit?",
    "Wer aus dieser Runde ist dir am sympathischsten?",
    "Was war deine größte Lüge, die du je erzählt hast?",
    "Was ist deine dümmste oder seltsamste Angewohnheit?",
    "Wer in dieser Runde hat das beste Aussehen?",
    "Was war der seltsamste Traum, den du je hattest?",
    "Wofür hast du dich zuletzt so richtig geschämt?",
    "Wovor hast du die meiste Angst im Leben?",
    "Was ist das Verrückteste oder Illegale, das du je getan hast?",
    "Was war der schlimmste Modefehler, den du je begangen hast?",
    "Welche Person in dieser Runde würdest du auf eine einsame Insel mitnehmen?",
    "Hast du schon mal heimlich das Handy von jemand anderem durchsucht?",
    "Was war dein schlimmstes Date aller Zeiten?",
    "Was singst du heimlich unter der Dusche?",
    "Was ist die schlimmste Angewohnheit, die du bei anderen hasst?"
  ];

  const DARES = [
    "Mache 10 Liegestütze oder 15 Kniebeugen.",
    "Imitiere ein Tier deiner Wahl, bis jemand errät, was es ist.",
    "Trinke ein ganzes Glas Wasser so schnell wie möglich aus.",
    "Sprich für die nächsten zwei Runden mit einem Akzent/Dialekt deiner Wahl.",
    "Mache der Person links von dir ein sehr ehrliches Kompliment.",
    "Tanze ohne Musik für 30 Sekunden mitten im Raum.",
    "Lasse dir von den anderen Mitspielern eine lustige Frisur machen.",
    "Versuche für 15 Sekunden, deinen Ellenbogen zu lecken.",
    "Erzähle einen extrem schlechten Flachwitz.",
    "Balanciere einen Löffel oder Stift auf deiner Nase für 15 Sekunden.",
    "Lies deine letzte empfangene Nachricht laut vor (ohne den Absender zu verraten).",
    "Tue so, als wärst du ein Butler/eine Zofe für die nächste Runde.",
    "Bewerte das Outfit jedes Mitspielers auf einer Skala von 1 bis 10.",
    "Lass dich für 10 Sekunden durchkitzeln, ohne zu lachen.",
    "Laufe einmal im Krebsgang (auf Händen und Füßen rückwärts) durch den Raum."
  ];

  let activePlayers = [];
  let currentRotation = 0;
  let isSpinning = false;

  function setup(container, config) {
    container.innerHTML = `
      <div class="game-setup-panel">
        <div class="setup-scroll-content">
          <h2 class="setup-title">Flaschendrehen</h2>
          <p class="setup-desc">Wähle die Mitspieler aus. Die Flasche entscheidet, wer an der Reihe ist!</p>
          
          <div class="setup-group">
            <span class="setup-group-label">Wer spielt mit? (Mind. 2 benötigt)</span>
            <div class="setup-players-toggle" id="td-players-list">
              <!-- Injected player chips -->
            </div>
          </div>
        </div>
        
        <div class="start-action-container">
          <button id="btn-start-td-game" class="btn-start-game ripple-effect haptic-press">
            <span>Spiel starten</span>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    const playersListContainer = document.getElementById('td-players-list');
    const selectedPlayers = [...config.globalPlayers];

    config.globalPlayers.forEach(player => {
      const chip = document.createElement('span');
      chip.className = "player-chip active";
      chip.textContent = player;
      chip.onclick = () => {
        if (chip.classList.contains('active')) {
          if (selectedPlayers.length <= 2) {
            alert("Du brauchst mindestens 2 Spieler!");
            return;
          }
          chip.classList.remove('active');
          const idx = selectedPlayers.indexOf(player);
          if (idx > -1) selectedPlayers.splice(idx, 1);
        } else {
          chip.classList.add('active');
          selectedPlayers.push(player);
        }
      };
      playersListContainer.appendChild(chip);
    });

    document.getElementById('btn-start-td-game').onclick = () => {
      config.onStart(selectedPlayers, {});
    };
  }

  function start(container, players, config) {
    activePlayers = players;
    currentRotation = 0;
    isSpinning = false;

    renderBoard(container);
  }

  function renderBoard(container) {
    container.innerHTML = `
      <div class="game-play-area" style="justify-content: space-around;">
        <h2 id="td-status-text" class="current-player-turn">Drehe die Flasche!</h2>
        
        <div class="bottle-container">
          <div class="player-names-circle" id="radial-names-container"></div>
          <div id="bottle-spinner" class="bottle-spinner"></div>
          <div class="bottle-center-pin"></div>
        </div>
        
        <div class="td-decision-box" id="td-action-area">
          <button id="btn-spin-bottle" class="btn-pass-bomb ripple-effect haptic-press" style="background-color: var(--color-primary);">Flasche drehen</button>
        </div>
      </div>
    `;

    // Render radial names
    const namesContainer = document.getElementById('radial-names-container');
    const total = activePlayers.length;
    
    activePlayers.forEach((player, idx) => {
      const nameEl = document.createElement('div');
      nameEl.className = "player-radial-name";
      nameEl.textContent = player;
      
      // Calculate layout angle in degrees
      const angle = (idx / total) * 360;
      
      // Adjust transform: rotate, translate outwards, then rotate back so text remains horizontal
      // Adjust translate radius depending on list length
      const radius = total > 6 ? 85 : 75;
      nameEl.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`;
      namesContainer.appendChild(nameEl);
    });

    // Spin trigger
    document.getElementById('btn-spin-bottle').onclick = () => {
      if (isSpinning) return;
      spinBottle();
    };
  }

  function spinBottle() {
    isSpinning = true;
    document.getElementById('td-status-text').textContent = "Die Flasche dreht sich...";
    
    const spinner = document.getElementById('bottle-spinner');
    
    // Choose random winner
    const winnerIdx = Math.floor(Math.random() * activePlayers.length);
    const winnerName = activePlayers[winnerIdx];
    
    // Total steps/spins: e.g. 5-7 spins
    const totalSpins = 4 + Math.floor(Math.random() * 4);
    // Radial angle for this winner
    const winnerAngle = (winnerIdx / activePlayers.length) * 360;
    
    // Target degrees: must add up to current rotation so it spins forward smoothly
    // In CSS rotate, 0deg points UP. Our bottle spinner points UP. So target is winnerAngle.
    const targetDegrees = currentRotation + (totalSpins * 360) + winnerAngle;
    
    spinner.style.transform = `rotate(${targetDegrees}deg)`;
    currentRotation = targetDegrees;

    // Simulate sound ticks during spin
    let tickCount = 0;
    const playSpinTicks = () => {
      if (tickCount < 20) {
        window.AudioSynth.playTick(1200 - (tickCount * 40));
        tickCount++;
        setTimeout(playSpinTicks, 100 + (tickCount * 12)); // exponential deceleration
      }
    };
    playSpinTicks();

    // End of spin duration (3 seconds transition)
    setTimeout(() => {
      isSpinning = false;
      document.getElementById('td-status-text').textContent = `${winnerName} wurde ausgewählt!`;
      
      // Play ding sound
      window.AudioSynth.playTick(1800);

      // Flash winner name
      const names = document.querySelectorAll('.player-radial-name');
      names[winnerIdx].style.color = "var(--color-primary)";
      names[winnerIdx].style.fontSize = "16px";
      names[winnerIdx].style.fontWeight = "800";

      // Render Truth/Dare buttons
      showChoiceButtons(winnerName);
    }, 3000);
  }

  function showChoiceButtons(playerName) {
    const actionArea = document.getElementById('td-action-area');
    actionArea.innerHTML = `
      <div class="td-choices-row">
        <button id="btn-choice-truth" class="btn-td-choice btn-truth ripple-effect haptic-press">Wahrheit</button>
        <button id="btn-choice-dare" class="btn-td-choice btn-dare ripple-effect haptic-press">Pflicht</button>
      </div>
    `;

    document.getElementById('btn-choice-truth').onclick = () => {
      showPrompt(playerName, "Wahrheit", TRUTHS);
    };

    document.getElementById('btn-choice-dare').onclick = () => {
      showPrompt(playerName, "Pflicht", DARES);
    };
  }

  function showPrompt(playerName, type, list) {
    const container = document.getElementById('game-dynamic-container');
    const prompt = list[Math.floor(Math.random() * list.length)];

    container.innerHTML = `
      <div class="game-play-area">
        <h2 class="current-player-turn">${playerName} (${type})</h2>
        
        <div class="td-prompt-card">
          <div class="td-prompt-header">${type}</div>
          <div class="td-prompt-body">${prompt}</div>
        </div>
        
        <button id="btn-prompt-done" class="btn-pass-bomb ripple-effect haptic-press" style="background-color: var(--color-primary);">Aufgabe erledigt</button>
      </div>
    `;

    document.getElementById('btn-prompt-done').onclick = () => {
      // Return to board
      renderBoard(container);
    };
  }

  function destroy() {
    isSpinning = false;
  }

  window.TruthDareGame = {
    name: "Wahrheit oder Pflicht",
    setup: setup,
    start: start,
    destroy: destroy
  };
})();
