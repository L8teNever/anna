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

  const LETTERS = "ABCDEFGHIJKLMNOPRSTUVW";

  let timerInterval = null;
  let remainingTime = 0;
  let totalTime = 60;
  let activePlayers = [];

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

  // Dual duty back navigation
  function initBackButton() {
    const backBtn = document.getElementById('game-back-btn');
    backBtn.onclick = () => {
      const setupPanel = document.getElementById('setup-panel');
      const playPanel = document.getElementById('play-panel');
      const timeUpPanel = document.getElementById('time-up-panel');

      if (!playPanel.classList.contains('hidden') || !timeUpPanel.classList.contains('hidden')) {
        // Exit active gameplay and return to setup panel
        clearInterval(timerInterval);
        window.WakeLock.release();
        playPanel.classList.add('hidden');
        timeUpPanel.classList.add('hidden');
        setupPanel.classList.remove('hidden');
      } else {
        // Return to homepage
        window.location.href = '../';
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

    // Render players
    const list = document.getElementById('cat-players-list');
    list.innerHTML = '';
    players.forEach(p => {
      const chip = document.createElement('span');
      chip.className = "player-chip active";
      chip.textContent = p;
      list.appendChild(chip);
    });

    // Timer selector toggles
    let selectedTime = 60;
    const timerChips = document.getElementById('cat-timer-selector').querySelectorAll('.player-chip');
    timerChips.forEach(chip => {
      chip.onclick = () => {
        timerChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedTime = parseInt(chip.getAttribute('data-time'));
      };
    });

    // Start Button trigger
    document.getElementById('btn-start-cat-game').onclick = () => {
      startGame(selectedTime);
    };
  }

  function startGame(timeSeconds) {
    totalTime = timeSeconds;
    remainingTime = totalTime;

    // Toggle panels
    document.getElementById('setup-panel').classList.add('hidden');
    document.getElementById('time-up-panel').classList.add('hidden');
    document.getElementById('play-panel').classList.remove('hidden');

    window.WakeLock.request();

    generateRound();

    // Stop timer trigger
    document.getElementById('btn-stop-timer').onclick = () => {
      timeIsUp();
    };
  }

  function generateRound() {
    // Pick random letter
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const letterBox = document.getElementById('letter-box');
    if (letterBox) {
      letterBox.textContent = letter;
      // Trigger CSS entry animation
      letterBox.classList.remove('roll-letter-anim');
      void letterBox.offsetWidth; // trigger reflow
      letterBox.classList.add('roll-letter-anim');
    }
    
    // Pick 5 unique random categories
    const selectedCats = [];
    const tempCats = [...CATEGORIES];
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(Math.random() * tempCats.length);
      selectedCats.push(tempCats.splice(idx, 1)[0]);
    }

    // Populate categories list HTML
    const listContainer = document.getElementById('categories-list-container');
    listContainer.innerHTML = selectedCats.map(cat => `
      <div class="category-item-row">
        <span class="category-label">${cat}</span>
        <span style="color: var(--color-outline); font-size: 13px;">mit ${letter}</span>
      </div>
    `).join('');

    // Start interval timer
    remainingTime = totalTime;
    updateTimerVisual();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      remainingTime--;
      
      if (remainingTime <= 0) {
        timeIsUp();
      } else {
        updateTimerVisual();
        // Tick alarm sounds
        const isWarning = remainingTime <= 10;
        window.AudioSynth.playTick(isWarning ? 1400 : 900);
      }
    }, 1000);
  }

  function updateTimerVisual() {
    const textVal = document.getElementById('timer-text-val');
    const circle = document.getElementById('timer-progress');
    
    if (textVal) textVal.textContent = remainingTime;
    
    if (circle) {
      const radius = 45;
      const circumference = 2 * Math.PI * radius;
      const progressFraction = remainingTime / totalTime;
      const offset = circumference * (1 - progressFraction);
      
      circle.style.strokeDashoffset = offset;
      
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

    window.AudioSynth.playBuzzer();

    // Toggle panels
    document.getElementById('play-panel').classList.add('hidden');
    document.getElementById('time-up-panel').classList.remove('hidden');

    // Next round trigger
    document.getElementById('btn-next-round-cat').onclick = () => {
      startGame(totalTime);
    };
  }
})();
