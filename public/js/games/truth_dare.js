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
  let lastWinnerName = "";

  document.addEventListener('DOMContentLoaded', () => {
    initSoundBadge();
    initSetup();
    initBackButton();
  });

  // Sound Badge state management
  function initSoundBadge() {
    const soundBadge = document.getElementById('game-sound-badge');
    const updateSoundBadge = () => {
      if (window.AudioSynth.isEnabled()) {
        soundBadge.textContent = "Ton: Ein";
        soundBadge.style.backgroundColor = "var(--color-primary-container)";
        soundBadge.style.color = "var(--color-on-primary-container)";
      } else {
        soundBadge.textContent = "Ton: Aus";
        soundBadge.style.backgroundColor = "var(--color-surface-variant)";
        soundBadge.style.color = "var(--color-on-surface-variant)";
      }
    };

    soundBadge.onclick = () => {
      window.AudioSynth.toggleSound(!window.AudioSynth.isEnabled());
      updateSoundBadge();
    };
    updateSoundBadge();
  }

  // Dual/triple duty back navigation
  function initBackButton() {
    const backBtn = document.getElementById('game-back-btn');
    backBtn.onclick = () => {
      const setupPanel = document.getElementById('setup-panel');
      const playBottlePanel = document.getElementById('play-bottle-panel');
      const playPromptPanel = document.getElementById('play-prompt-panel');

      if (!playPromptPanel.classList.contains('hidden')) {
        // From prompt page, return to bottle spin board
        playPromptPanel.classList.add('hidden');
        playBottlePanel.classList.remove('hidden');
        resetActionArea();
      } else if (!playBottlePanel.classList.contains('hidden')) {
        // From bottle spin board, return to setup screen
        window.WakeLock.release();
        playBottlePanel.classList.add('hidden');
        setupPanel.classList.remove('hidden');
      } else {
        // From setup screen, return to homepage
        window.location.href = '../index.html';
      }
    };
  }

  function initSetup() {
    let players = ['Anna', 'Ben', 'Clara', 'David'];
    const saved = localStorage.getItem('party_players');
    if (saved) {
      try {
        players = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse players", e);
      }
    }

    const listContainer = document.getElementById('td-players-list');
    listContainer.innerHTML = '';
    const selectedPlayers = [...players];

    players.forEach(player => {
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
      listContainer.appendChild(chip);
    });

    document.getElementById('btn-start-td-game').onclick = () => {
      startGame(selectedPlayers);
    };
  }

  function startGame(players) {
    activePlayers = players;
    currentRotation = 0;
    isSpinning = false;

    // Toggle panels
    document.getElementById('setup-panel').classList.add('hidden');
    document.getElementById('play-bottle-panel').classList.remove('hidden');

    window.WakeLock.request();

    // Render radial names
    const namesContainer = document.getElementById('radial-names-container');
    namesContainer.innerHTML = '';
    const total = activePlayers.length;
    
    activePlayers.forEach((player, idx) => {
      const nameEl = document.createElement('div');
      nameEl.className = "player-radial-name";
      nameEl.textContent = player;
      
      const angle = (idx / total) * 360;
      const radius = total > 6 ? 85 : 75;
      nameEl.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`;
      namesContainer.appendChild(nameEl);
    });

    resetActionArea();
  }

  function resetActionArea() {
    document.getElementById('td-status-text').textContent = "Drehe die Flasche!";
    const actionArea = document.getElementById('td-action-area');
    actionArea.innerHTML = `<button id="btn-spin-bottle" class="btn-pass-bomb ripple-effect haptic-press" style="background-color: var(--color-primary);">Flasche drehen</button>`;
    
    document.getElementById('btn-spin-bottle').onclick = () => {
      if (isSpinning) return;
      spinBottle();
    };

    // Reset names font size and color
    const names = document.querySelectorAll('.player-radial-name');
    names.forEach(name => {
      name.style.color = "var(--color-on-surface)";
      name.style.fontSize = "13px";
      name.style.fontWeight = "600";
    });
  }

  function spinBottle() {
    isSpinning = true;
    document.getElementById('td-status-text').textContent = "Die Flasche dreht sich...";
    
    const spinner = document.getElementById('bottle-spinner');
    
    const winnerIdx = Math.floor(Math.random() * activePlayers.length);
    const winnerName = activePlayers[winnerIdx];
    lastWinnerName = winnerName;
    
    const totalSpins = 4 + Math.floor(Math.random() * 4);
    const winnerAngle = (winnerIdx / activePlayers.length) * 360;
    const targetDegrees = currentRotation + (totalSpins * 360) + winnerAngle;
    
    spinner.style.transform = `rotate(${targetDegrees}deg)`;
    currentRotation = targetDegrees;

    // Spin sound clicks
    let tickCount = 0;
    const playSpinTicks = () => {
      if (tickCount < 20) {
        window.AudioSynth.playTick(1200 - (tickCount * 40));
        tickCount++;
        setTimeout(playSpinTicks, 100 + (tickCount * 12));
      }
    };
    playSpinTicks();

    // 3 seconds rotation transition
    setTimeout(() => {
      isSpinning = false;
      document.getElementById('td-status-text').textContent = `${winnerName} wurde ausgewählt!`;
      
      window.AudioSynth.playTick(1800);

      // Highlight winner name radial text
      const names = document.querySelectorAll('.player-radial-name');
      if (names[winnerIdx]) {
        names[winnerIdx].style.color = "var(--color-primary)";
        names[winnerIdx].style.fontSize = "16px";
        names[winnerIdx].style.fontWeight = "800";
      }

      // Show Truth or Dare buttons
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
    const prompt = list[Math.floor(Math.random() * list.length)];

    // Populate elements
    document.getElementById('td-prompt-player').textContent = `${playerName} (${type})`;
    document.getElementById('td-prompt-header').textContent = type;
    document.getElementById('td-prompt-body').textContent = prompt;

    // Toggle panels
    document.getElementById('play-bottle-panel').classList.add('hidden');
    document.getElementById('play-prompt-panel').classList.remove('hidden');

    document.getElementById('btn-prompt-done').onclick = () => {
      document.getElementById('play-prompt-panel').classList.add('hidden');
      document.getElementById('play-bottle-panel').classList.remove('hidden');
      resetActionArea();
    };
  }
})();
