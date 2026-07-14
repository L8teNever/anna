// Game Module: Stadt Land Fluss (Categories)

(function() {
  const CATEGORIES = [
    "Stadt",
    "Land",
    "Fluss",
    "Beruf",
    "Tier",
    "Pflanze",
    "Vorname",
    "Essen / Gericht",
    "Automarke",
    "Hobby / Sportart",
    "Kleidungsstück",
    "Ausrede fürs Zuspätkommen",
    "Grund zum Feiern",
    "Etwas Flüssiges",
    "Möbelstück / Deko",
    "Werkzeug / Baumarkt",
    "Promi / Musiker",
    "Film / Serie / Buch",
    "Schimpfwort / Fluch",
    "Etwas, das man im Badezimmer findet",
    "Eissorte / Süßigkeit",
    "Teil eines Autos",
    "Etwas Gelbes",
    "Todesursache im Krimi"
  ];

  const LETTERS = "ABCDEFGHIJKLMNOPRSTUVW"; // Exclude Q, X, Y, Z for better gameplay flow

  let timerInterval = null;
  let remainingTime = 0;
  let totalTime = 60; // default 60s
  let activePlayers = [];

  function setup(container, config) {
    container.innerHTML = `
      <div class="game-setup-panel">
        <div class="setup-scroll-content">
          <h2 class="setup-title">Stadt Land Fluss</h2>
          <p class="setup-desc">Finde Begriffe zu den vorgegebenen Kategorien, die mit dem gewürfelten Buchstaben beginnen.</p>
          
          <div class="setup-group">
            <span class="setup-group-label">Spieler (nur zur Anzeige)</span>
            <div class="setup-players-toggle" id="cat-players-list">
              <!-- Injected player chips -->
            </div>
          </div>

          <div class="setup-group">
            <span class="setup-group-label">Timer-Dauer</span>
            <div class="setup-players-toggle" id="cat-timer-selector">
              <span class="player-chip" data-time="30">30 Sekunden</span>
              <span class="player-chip active" data-time="60">60 Sekunden</span>
              <span class="player-chip" data-time="90">90 Sekunden</span>
              <span class="player-chip" data-time="120">2 Minuten</span>
            </div>
          </div>
        </div>
        
        <div class="start-action-container">
          <button id="btn-start-cat-game" class="btn-start-game ripple-effect haptic-press">
            <span>Spiel starten</span>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Render players
    const list = document.getElementById('cat-players-list');
    config.globalPlayers.forEach(p => {
      const chip = document.createElement('span');
      chip.className = "player-chip active";
      chip.textContent = p;
      list.appendChild(chip);
    });

    // Timer duration selection
    let selectedTime = 60;
    const timerChips = document.getElementById('cat-timer-selector').querySelectorAll('.player-chip');
    timerChips.forEach(chip => {
      chip.onclick = () => {
        timerChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedTime = parseInt(chip.getAttribute('data-time'));
      };
    });

    document.getElementById('btn-start-cat-game').onclick = () => {
      config.onStart(config.globalPlayers, { time: selectedTime });
    };
  }

  function start(container, players, config) {
    activePlayers = players;
    totalTime = config.time || 60;
    remainingTime = totalTime;

    generateRound(container);
  }

  function generateRound(container) {
    // Pick random letter
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    
    // Pick 5 unique random categories
    const selectedCats = [];
    const tempCats = [...CATEGORIES];
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(Math.random() * tempCats.length);
      selectedCats.push(tempCats.splice(idx, 1)[0]);
    }

    // Render Play UI
    container.innerHTML = `
      <div class="game-play-area">
        <div class="letter-display-box roll-letter-anim" id="letter-box">${letter}</div>
        
        <div class="categories-list">
          ${selectedCats.map(cat => `
            <div class="category-item-row">
              <span class="category-label">${cat}</span>
              <span style="color: var(--color-outline); font-size: 13px;">mit ${letter}</span>
            </div>
          `).join('')}
        </div>
        
        <!-- SVGCircular progress timer -->
        <div class="timer-container">
          <svg class="timer-svg" viewBox="0 0 100 100">
            <circle class="timer-circle-bg" cx="50" cy="50" r="45"/>
            <circle id="timer-progress" class="timer-circle-progress" cx="50" cy="50" r="45"/>
          </svg>
          <div id="timer-text-val" class="timer-text">${remainingTime}</div>
        </div>
        
        <button id="btn-stop-timer" class="btn-pass-bomb ripple-effect haptic-press" style="background-color: var(--color-error);">STOP / FERTIG</button>
      </div>
    `;

    // Screen wake lock
    window.WakeLock.request();

    // Start countdown
    remainingTime = totalTime;
    updateTimerVisual();
    
    timerInterval = setInterval(() => {
      remainingTime--;
      
      if (remainingTime <= 0) {
        timeIsUp();
      } else {
        updateTimerVisual();
        // Play tick sound at 1s intervals, pitching up slightly when <10s
        const isWarning = remainingTime <= 10;
        window.AudioSynth.playTick(isWarning ? 1400 : 900);
      }
    }, 1000);

    document.getElementById('btn-stop-timer').onclick = () => {
      timeIsUp();
    };
  }

  function updateTimerVisual() {
    const textVal = document.getElementById('timer-text-val');
    const circle = document.getElementById('timer-progress');
    
    if (textVal) textVal.textContent = remainingTime;
    
    if (circle) {
      const radius = 45;
      const circumference = 2 * Math.PI * radius; // ~282.7
      const progressFraction = remainingTime / totalTime;
      const offset = circumference * (1 - progressFraction);
      
      circle.style.strokeDashoffset = offset;
      
      // Warn when less than 10 seconds remaining
      if (remainingTime <= 10) {
        circle.classList.add('warning');
      } else {
        circle.classList.remove('warning');
      }
    }
  }

  function timeIsUp() {
    clearInterval(timerInterval);
    window.WakeLock.release();

    // Play buzzer alarm
    window.AudioSynth.playBuzzer();

    const container = document.getElementById('game-dynamic-container');
    container.innerHTML = `
      <div class="game-play-area" style="justify-content: center; gap: 32px;">
        <h2 class="current-player-turn" style="font-size: 32px; color: var(--color-error);">ZEIT ABGELAUFEN!</h2>
        <p style="font-size: 16px; text-align: center; color: var(--color-on-surface-variant);">Vergleicht eure aufgeschriebenen Wörter und verteilt die Punkte.</p>
        
        <button id="btn-next-round-cat" class="btn-pass-bomb ripple-effect haptic-press" style="background-color: var(--color-primary); max-width: 250px;">Nächste Runde</button>
      </div>
    `;

    document.getElementById('btn-next-round-cat').onclick = () => {
      container.innerHTML = "";
      remainingTime = totalTime;
      generateRound(container);
    };
  }

  function destroy() {
    clearInterval(timerInterval);
    window.WakeLock.release();
  }

  window.CategoriesGame = {
    name: "Stadt Land Fluss",
    setup: setup,
    start: start,
    destroy: destroy
  };
})();
