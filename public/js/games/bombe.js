// Game Module: Tickende Bombe
(function() {
  const TASKS = [
    "Nenne ein Tier mit B",
    "Nenne etwas, das grün ist",
    "Nenne einen Beruf mit M",
    "Nenne eine Automarke",
    "Nenne etwas, das man im Kühlschrank findet",
    "Nenne einen Fluss in Europa",
    "Nenne ein Land mit S",
    "Nenne ein Schulfach",
    "Nenne eine Süßigkeit",
    "Nenne etwas, das man im Flugzeug mitnimmt",
    "Nenne eine Comic- oder Zeichentrickfigur",
    "Nenne etwas, das sehr heiß ist",
    "Nenne eine Programmiersprache",
    "Nenne etwas Rundes",
    "Nenne eine Stadt in Deutschland",
    "Nenne ein Musikinstrument",
    "Nenne ein Werkzeug",
    "Nenne etwas aus Holz",
    "Nenne ein Kleidungsstück",
    "Nenne eine Obst- oder Gemüsesorte",
    "Nenne eine Sportart",
    "Nenne eine Farbe mit G",
    "Nenne etwas, das stinkt",
    "Nenne einen Superhelden",
    "Nenne einen Filmtitel",
    "Nenne etwas, das fliegen kann",
    "Nenne ein Hobby",
    "Nenne etwas aus Plastik",
    "Nenne ein Möbelstück",
    "Nenne etwas, das man am Strand macht"
  ];

  let tickTimeout = null;
  let activePlayers = [];
  let currentPlayerIndex = 0;
  let startTime = 0;
  let duration = 0;

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

  // Double duty back button
  function initBackButton() {
    const backBtn = document.getElementById('game-back-btn');
    backBtn.onclick = () => {
      const playPanel = document.getElementById('play-panel');
      const setupPanel = document.getElementById('setup-panel');
      if (!playPanel.classList.contains('hidden')) {
        // Exit active gameplay and return to setup panel
        clearTimeout(tickTimeout);
        window.WakeLock.release();
        playPanel.classList.add('hidden');
        setupPanel.classList.remove('hidden');
        document.getElementById('bomb-explosion-overlay').classList.remove('show');
      } else {
        // Return to homepage
        window.location.href = '../index.html';
      }
    };
  }

  function initSetup() {
    // 1. Load players list from localStorage
    let players = ['Anna', 'Ben', 'Clara', 'David'];
    const saved = localStorage.getItem('party_players');
    if (saved) {
      try {
        players = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse players", e);
      }
    }

    // Render chips
    const listContainer = document.getElementById('bomb-players-list');
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

    // Duration Selector Toggles
    let selectedDuration = "short";
    const durationChips = document.getElementById('bomb-duration-selector').querySelectorAll('.player-chip');
    durationChips.forEach(chip => {
      chip.onclick = () => {
        durationChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedDuration = chip.getAttribute('data-duration');
      };
    });

    // Start Button trigger
    document.getElementById('btn-start-bomb-game').onclick = () => {
      startGame(selectedPlayers, selectedDuration);
    };
  }

  function startGame(players, durationKey) {
    activePlayers = players;
    currentPlayerIndex = Math.floor(Math.random() * activePlayers.length);

    // Calculate game length
    let minSec = 15, maxSec = 30;
    if (durationKey === "medium") { minSec = 30; maxSec = 50; }
    if (durationKey === "long") { minSec = 50; maxSec = 80; }
    duration = (minSec + Math.random() * (maxSec - minSec)) * 1000;

    startTime = Date.now();

    // Toggle panels
    document.getElementById('setup-panel').classList.add('hidden');
    document.getElementById('play-panel').classList.remove('hidden');

    // Turn wake lock on
    window.WakeLock.request();

    // Load first turn
    nextTurn();

    // Pass bomb button click
    const passBtn = document.getElementById('btn-pass-bomb');
    passBtn.onclick = () => {
      currentPlayerIndex = (currentPlayerIndex + 1) % activePlayers.length;
      nextTurn();
    };

    // Begin ticking loop
    tickLoop();
  }

  function nextTurn() {
    const turnInd = document.getElementById('bomb-turn-indicator');
    if (turnInd) {
      turnInd.textContent = `${activePlayers[currentPlayerIndex]} hat die Bombe!`;
    }

    const taskText = document.getElementById('bomb-task-text');
    if (taskText) {
      const randomTask = TASKS[Math.floor(Math.random() * TASKS.length)];
      taskText.textContent = randomTask;
    }
  }

  function tickLoop() {
    const elapsed = Date.now() - startTime;
    const remaining = duration - elapsed;

    if (remaining <= 0) {
      explode();
      return;
    }

    const progress = elapsed / duration;
    const minInterval = 120;
    const maxInterval = 1000;
    const interval = maxInterval - (maxInterval - minInterval) * Math.pow(progress, 1.8);

    const visual = document.getElementById('bomb-visual');
    if (visual) {
      if (progress > 0.7) {
        visual.className = "bomb-container fast-ticking";
      } else {
        visual.className = "bomb-container ticking";
      }
    }

    const pitch = 800 + (progress * 800);
    window.AudioSynth.playTick(pitch);

    tickTimeout = setTimeout(tickLoop, interval);
  }

  function explode() {
    const overlay = document.getElementById('bomb-explosion-overlay');
    const loserText = document.getElementById('bomb-loser-text');
    if (overlay && loserText) {
      loserText.textContent = `${activePlayers[currentPlayerIndex]} hat verloren!`;
      overlay.classList.add('show');
    }

    window.AudioSynth.playExplosion();
    window.WakeLock.release();

    // Restart button trigger
    const restartBtn = document.getElementById('btn-bomb-restart');
    restartBtn.onclick = () => {
      overlay.classList.remove('show');
      startGame(activePlayers, document.getElementById('bomb-duration-selector').querySelector('.player-chip.active').getAttribute('data-duration'));
    };
  }
})();
