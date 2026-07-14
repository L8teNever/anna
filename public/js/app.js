// Main Orchestrator for Party Games App

// Global State
const state = {
  players: ['Anna', 'Ben', 'Clara', 'David'],
  theme: 'dark',
  accent: 'blue'
};

document.addEventListener('DOMContentLoaded', () => {
  initSettings();
  initRouting();
  initSearch();
  initPlayerManagement();
  initGDPR();
});

// --- App Settings (Theme, Accents, Sounds) ---
function initSettings() {
  // 1. Load Theme (Dark/Light)
  const savedTheme = localStorage.getItem('settings_theme');
  if (savedTheme) {
    state.theme = savedTheme;
  } else {
    // Media query fallback
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      state.theme = 'light';
    }
  }
  document.documentElement.setAttribute('data-theme', state.theme);
  
  const dmToggle = document.getElementById('settings-darkmode-toggle');
  dmToggle.checked = (state.theme === 'dark');
  dmToggle.addEventListener('change', (e) => {
    state.theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('settings_theme', state.theme);
  });

  // 2. Load Accent Color
  const savedAccent = localStorage.getItem('settings_accent');
  if (savedAccent) {
    state.accent = savedAccent;
  }
  document.documentElement.setAttribute('data-accent', state.accent);
  
  const accentBubbles = document.querySelectorAll('.accent-bubble');
  accentBubbles.forEach(bubble => {
    const acc = bubble.getAttribute('data-accent');
    if (acc === state.accent) {
      bubble.classList.add('active');
    } else {
      bubble.classList.remove('active');
    }

    bubble.onclick = () => {
      accentBubbles.forEach(b => b.classList.remove('active'));
      bubble.classList.add('active');
      state.accent = acc;
      document.documentElement.setAttribute('data-accent', acc);
      localStorage.setItem('settings_accent', acc);
    };
  });

  // 3. Load Sound Option
  const soundToggle = document.getElementById('settings-sound-toggle');
  soundToggle.checked = window.AudioSynth.isEnabled();
  soundToggle.addEventListener('change', (e) => {
    window.AudioSynth.toggleSound(e.target.checked);
    updateGameSoundBadge();
  });

  // 4. Load Players
  const savedPlayers = localStorage.getItem('party_players');
  if (savedPlayers) {
    try {
      state.players = JSON.parse(savedPlayers);
    } catch(e) {
      console.error("Failed to parse players list", e);
    }
  }
}
// --- Routing & Layout transitions ---
function initRouting() {
  const settingsBtn = document.getElementById('global-settings-btn');
  const gameCards = document.querySelectorAll('.widget-card');
  
  // Settings Panel trigger
  settingsBtn.onclick = () => {
    openSettings();
  };

  document.getElementById('settings-close-btn').onclick = closeSettings;
  document.getElementById('modal-backdrop').onclick = closeSettings;

  // Game card click (navigates to clean directory URL)
  gameCards.forEach(card => {
    card.onclick = () => {
      const gameId = card.getAttribute('data-game-id');
      window.location.href = `${gameId}/`;
    };
  });
}

function openSettings() {
  const settingsSheet = document.getElementById('settings-sheet');
  const modalBackdrop = document.getElementById('modal-backdrop');
  settingsSheet.classList.add('show');
  modalBackdrop.classList.add('show');
}

function closeSettings() {
  const settingsSheet = document.getElementById('settings-sheet');
  const modalBackdrop = document.getElementById('modal-backdrop');
  if (settingsSheet) settingsSheet.classList.remove('show');
  if (modalBackdrop) modalBackdrop.classList.remove('show');
}

// --- Game Search feature ---
function initSearch() {
  const searchInput = document.getElementById('game-search-input');
  const gameCards = document.querySelectorAll('.widget-card');

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    
    gameCards.forEach(card => {
      const title = card.querySelector('.widget-title').textContent.toLowerCase();
      const desc = card.querySelector('.widget-desc').textContent.toLowerCase();
      
      if (title.includes(val) || desc.includes(val)) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  });
}

// --- Player Management ---
function initPlayerManagement() {
  renderPlayerList();

  const addBtn = document.getElementById('global-add-player-btn');
  const input = document.getElementById('global-new-player-input');

  const addPlayer = () => {
    const name = input.value.trim();
    if (name) {
      if (state.players.includes(name)) {
        alert("Dieser Name existiert bereits!");
        return;
      }
      state.players.push(name);
      localStorage.setItem('party_players', JSON.stringify(state.players));
      input.value = "";
      renderPlayerList();
    }
  };

  addBtn.onclick = addPlayer;
  input.onkeypress = (e) => {
    if (e.key === 'Enter') {
      addPlayer();
    }
  };
}

function renderPlayerList() {
  const list = document.getElementById('global-player-list');
  list.innerHTML = "";

  state.players.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = "player-item";
    
    const nameSpan = document.createElement('span');
    nameSpan.className = "player-name-val";
    nameSpan.textContent = player;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = "player-remove-btn ripple-effect haptic-press";
    removeBtn.setAttribute('aria-label', `${player} entfernen`);
    removeBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
    `;
    
    removeBtn.onclick = () => {
      // Must have at least 1 player
      if (state.players.length <= 1) {
        alert("Du musst mindestens einen Spieler behalten!");
        return;
      }
      state.players.splice(index, 1);
      localStorage.setItem('party_players', JSON.stringify(state.players));
      renderPlayerList();
    };

    item.appendChild(nameSpan);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

// --- GDPR Accordion toggling ---
function initGDPR() {
  const trigger = document.getElementById('accordion-trigger');
  const content = document.getElementById('accordion-content');
  const footerLink = document.getElementById('footer-gdpr-link');

  const toggle = () => {
    trigger.classList.toggle('active');
    content.classList.toggle('show');
  };

  trigger.onclick = toggle;

  footerLink.onclick = () => {
    // Open settings and toggle accordion
    document.getElementById('global-settings-btn').click();
    // Scroll settings to bottom
    setTimeout(() => {
      document.getElementById('settings-sheet').querySelector('.sheet-content').scrollTo({
        top: 1000,
        behavior: 'smooth'
      });
      // Expand if not already expanded
      if (!content.classList.contains('show')) {
        toggle();
      }
    }, 300);
  };
}
