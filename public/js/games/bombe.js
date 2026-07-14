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

  let gameTimer = null;
  let tickTimeout = null;
  let activePlayers = [];
  let currentPlayerIndex = 0;
  let startTime = 0;
  let duration = 0;
  let speedLevel = 1; // 1 = slow, 2 = fast

  function setup(container, config) {
    // Generate Setup HTML
    container.innerHTML = `
      <div class="game-setup-panel">
        <div class="setup-scroll-content">
          <h2 class="setup-title">Bomben-Setup</h2>
          <p class="setup-desc">Wähle die Mitspieler aus und stelle die Spieldauer ein. Wer die Bombe hält, wenn sie explodiert, verliert!</p>
          
          <div class="setup-group">
            <span class="setup-group-label">Wer spielt mit? (Mind. 2 benötigt)</span>
            <div class="setup-players-toggle" id="bomb-players-list">
              <!-- Injected player chips -->
            </div>
          </div>
          
          <div class="setup-group">
            <span class="setup-group-label">Ungefähre Spieldauer</span>
            <div class="setup-players-toggle" id="bomb-duration-selector">
              <span class="player-chip active" data-duration="short">Kurz (15-30s)</span>
              <span class="player-chip" data-duration="medium">Mittel (30-50s)</span>
              <span class="player-chip" data-duration="long">Lang (50-80s)</span>
            </div>
          </div>
        </div>
        
        <div class="start-action-container">
          <button id="btn-start-bomb-game" class="btn-start-game ripple-effect haptic-press">
            <span>Spiel starten</span>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Render players as toggleable chips
    const playersListContainer = document.getElementById('bomb-players-list');
    const selectedPlayers = [...config.globalPlayers]; // Default: all are active

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
      config.onStart(selectedPlayers, { duration: selectedDuration });
    };
  }

  function start(container, players, gameConfig) {
    activePlayers = players;
    // Pick random starting player
    currentPlayerIndex = Math.floor(Math.random() * activePlayers.length);
    
    // Determine random duration based on configuration
    const durConfig = gameConfig.duration || "short";
    let minSec = 15, maxSec = 30;
    if (durConfig === "medium") { minSec = 30; maxSec = 50; }
    if (durConfig === "long") { minSec = 50; maxSec = 80; }
    
    duration = (minSec + Math.random() * (maxSec - minSec)) * 1000; // in ms
    startTime = Date.now();
    speedLevel = 1;

    // Render Play UI
    container.innerHTML = `
      <div class="game-play-area">
        <div id="bomb-turn-indicator" class="current-player-turn">Anna ist dran!</div>
        
        <div class="bomb-task-box">
          <div class="bomb-task-label">Kategorie</div>
          <div id="bomb-task-text" class="bomb-task-text">Lädt...</div>
        </div>
        
        <div id="bomb-visual" class="bomb-container">
          <!-- SVG Bomb -->
          <svg class="bomb-icon-svg" viewBox="0 0 24 24">
            <path d="M19 10.5C19 6.91 16.09 4 12.5 4S6 6.91 6 10.5 8.91 17 12.5 17 19 14.09 19 10.5z"/>
            <!-- Fuse path -->
            <path d="M12.5 4V2.5c0-.28.22-.5.5-.5h2" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <!-- Spark SVG -->
          <svg class="bomb-spark-svg" viewBox="0 0 24 24">
            <path d="M12 2l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/>
          </svg>
        </div>
        
        <button id="btn-pass-bomb" class="btn-pass-bomb ripple-effect haptic-press">Weitergeben (Tippen)</button>
        
        <!-- Red Flash Explosion Overlay -->
        <div id="bomb-explosion-overlay" class="explosion-overlay">
          <div class="explosion-title">BOOM!</div>
          <div id="bomb-loser-text" class="explosion-loser">Die Bombe ist explodiert!</div>
          <button id="btn-bomb-restart" class="btn-retry ripple-effect haptic-press">Nochmal spielen</button>
        </div>
      </div>
    `;

    // Turn wake lock on
    window.WakeLock.request();

    // Trigger first task
    nextTurn();

    // Action listener
    const passBtn = document.getElementById('btn-pass-bomb');
    passBtn.onclick = () => {
      // Pass to next player
      currentPlayerIndex = (currentPlayerIndex + 1) % activePlayers.length;
      nextTurn();
    };

    // Begin sound and ticker loops
    tickLoop();
  }

  function nextTurn() {
    // Update player indicator
    const turnInd = document.getElementById('bomb-turn-indicator');
    if (turnInd) {
      turnInd.textContent = `${activePlayers[currentPlayerIndex]} hat die Bombe!`;
    }

    // Set a new random task
    const taskText = document.getElementById('bomb-task-text');
    if (taskText) {
      const randomTask = TASKS[Math.floor(Math.random() * TASKS.length)];
      taskText.textContent = randomTask;
    }
  }

  // Ticking loop using dynamic timeout to speed up gradually
  function tickLoop() {
    const elapsed = Date.now() - startTime;
    const remaining = duration - elapsed;

    if (remaining <= 0) {
      explode();
      return;
    }

    // Calculate current ticking interval
    // Starts at 1000ms, drops down to 100ms
    const progress = elapsed / duration; // 0 to 1
    const minInterval = 120;
    const maxInterval = 1000;
    const interval = maxInterval - (maxInterval - minInterval) * Math.pow(progress, 1.8);

    // Dynamic animation speeds
    const visual = document.getElementById('bomb-visual');
    if (visual) {
      if (progress > 0.7) {
        visual.className = "bomb-container fast-ticking";
      } else {
        visual.className = "bomb-container ticking";
      }
    }

    // Play tick sound with rising pitch
    const pitch = 800 + (progress * 800); // Pitch goes from 800Hz to 1600Hz
    window.AudioSynth.playTick(pitch);

    tickTimeout = setTimeout(tickLoop, interval);
  }

  function explode() {
    // Visual indicators
    const overlay = document.getElementById('bomb-explosion-overlay');
    const loserText = document.getElementById('bomb-loser-text');
    
    if (overlay && loserText) {
      loserText.textContent = `${activePlayers[currentPlayerIndex]} hat verloren!`;
      overlay.classList.add('show');
    }

    // Play sound explosion
    window.AudioSynth.playExplosion();
    window.WakeLock.release();

    const restartBtn = document.getElementById('btn-bomb-restart');
    restartBtn.onclick = () => {
      // Re-launch same game Setup
      document.getElementById('game-back-btn').click();
      setTimeout(() => {
        const card = document.getElementById('widget-bombe');
        if (card) card.click();
      }, 350);
    };
  }

  function destroy() {
    clearTimeout(tickTimeout);
    window.WakeLock.release();
  }

  // Register game
  window.BombeGame = {
    name: "Tickende Bombe",
    setup: setup,
    start: start,
    destroy: destroy
  };
})();
