/**
 * Logik der Startseite: rendert die Spiele-Karten aus GAMES
 * (game-registry.js), filtert live über Suche/Favoriten/Spieleranzahl und
 * steuert das Einstellungen-Modal.
 */
(function () {
  const topbar = document.getElementById("app-topbar");
  const grid = document.getElementById("game-grid");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("search-input");
  const clearSearchButton = document.getElementById("clear-search-button");
  const searchTriggerButton = document.getElementById("search-trigger-button");
  const filterToggleButton = document.getElementById("filter-toggle-button");
  const filterPanel = document.getElementById("filter-panel");
  const favFilterToggle = document.getElementById("fav-filter-toggle");
  const playerChipsContainer = document.getElementById("player-chips-container");
  const resetSearchButton = document.getElementById("reset-search-button");

  let searchActive = false;
  let showOnlyFavorites = false;
  let activePlayerFilter = "all";

  /* ------------------------------------------------------------------ */
  /* Rendering                                                            */
  /* ------------------------------------------------------------------ */
  function matchesPlayerFilter(game) {
    if (activePlayerFilter === "all") return true;
    if (activePlayerFilter === "8") return game.maxPlayers >= 8;
    const count = parseInt(activePlayerFilter, 10);
    return game.minPlayers <= count && game.maxPlayers >= count;
  }

  function renderGames(filterText) {
    const query = (filterText || "").trim().toLowerCase();
    const favorites = Storage.getFavorites();

    const matches = window.GAMES.filter((game) => {
      if (query && !game.name.toLowerCase().includes(query) && !game.description.toLowerCase().includes(query)) {
        return false;
      }
      if (showOnlyFavorites && !favorites.includes(game.id)) return false;
      if (!matchesPlayerFilter(game)) return false;
      return true;
    });

    grid.innerHTML = "";
    matches.forEach((game) => {
      const isFav = favorites.includes(game.id);
      const card = document.createElement("a");
      card.className = "m3-card--interactive game-card";
      card.dataset.color = game.color;
      card.href = `/${game.id}`;
      card.setAttribute("aria-label", `${game.name} öffnen`);
      card.innerHTML = `
        <div class="game-card__icon"><svg class="m3-icon"><use href="#icon-${game.icon}"></use></svg></div>
        <div class="game-card__meta">
          <span class="game-card__label">${game.tag}</span>
          <h2 class="game-card__title">${game.name}</h2>
          <span class="game-card__sub">${game.description}</span>
        </div>
        <div class="game-card__actions">
          <span class="game-card__badge">${game.minPlayers}–${game.maxPlayers} Spieler</span>
          <button type="button" class="game-card__fav" data-fav-id="${game.id}" aria-pressed="${isFav}" aria-label="Favorit" title="Favorit">
            <svg class="m3-icon"><use href="#icon-heart"></use></svg>
          </button>
        </div>
      `;

      // Klick + flüssiger Übergang übernimmt jetzt router.js zentral für
      // jeden internen <a>-Link - kein Extra-Handler hier nötig.
      grid.appendChild(card);
    });

    emptyState.hidden = matches.length > 0;
    emptyState.style.display = matches.length > 0 ? "none" : "";
  }

  function currentQuery() {
    return searchInput.value;
  }

  /* ------------------------------------------------------------------ */
  /* Such-Morph                                                           */
  /* ------------------------------------------------------------------ */
  function openSearch() {
    searchActive = true;
    topbar.dataset.searchActive = "true";
    setTimeout(() => searchInput.focus(), 200);
  }

  function closeSearch() {
    searchActive = false;
    topbar.dataset.searchActive = "false";
    searchInput.value = "";
    clearSearchButton.hidden = true;
    filterPanel.dataset.open = "false";
    renderGames("");
  }

  function resetAllFilters() {
    searchActive = false;
    topbar.dataset.searchActive = "false";
    searchInput.value = "";
    clearSearchButton.hidden = true;

    showOnlyFavorites = false;
    favFilterToggle.checked = false;

    activePlayerFilter = "all";
    playerChipsContainer.querySelectorAll(".m3-chip").forEach((el) => {
      el.setAttribute("aria-pressed", String(el.dataset.value === "all"));
    });

    filterPanel.dataset.open = "false";
    renderGames("");
  }

  searchTriggerButton.addEventListener("click", () => {
    if (searchActive) closeSearch();
    else openSearch();
  });

  searchInput.addEventListener("input", () => {
    clearSearchButton.hidden = searchInput.value.length === 0;
    renderGames(currentQuery());
  });

  clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchButton.hidden = true;
    searchInput.focus();
    renderGames("");
  });

  resetSearchButton.addEventListener("click", resetAllFilters);

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && searchActive) closeSearch();
    },
    { signal: Router.signal }
  );

  /* ------------------------------------------------------------------ */
  /* Filter-Panel                                                         */
  /* ------------------------------------------------------------------ */
  filterToggleButton.addEventListener("click", () => {
    filterPanel.dataset.open = filterPanel.dataset.open === "true" ? "false" : "true";
  });

  favFilterToggle.addEventListener("change", () => {
    showOnlyFavorites = favFilterToggle.checked;
    renderGames(currentQuery());
  });

  playerChipsContainer.addEventListener("click", (event) => {
    const chip = event.target.closest(".m3-chip");
    if (!chip) return;
    activePlayerFilter = chip.dataset.value;
    playerChipsContainer.querySelectorAll(".m3-chip").forEach((el) => {
      el.setAttribute("aria-pressed", String(el === chip));
    });
    renderGames(currentQuery());
  });

  /* ------------------------------------------------------------------ */
  /* Favoriten                                                            */
  /* ------------------------------------------------------------------ */
  grid.addEventListener("click", (event) => {
    const favButton = event.target.closest("[data-fav-id]");
    if (!favButton) return;
    event.stopPropagation();
    event.preventDefault(); // Verhindert Navigation über den <a>-Eltern-Link
    const favorites = Storage.toggleFavorite(favButton.dataset.favId);
    const isFav = favorites.includes(favButton.dataset.favId);
    favButton.setAttribute("aria-pressed", String(isFav));
    Toast.show(isFav ? "Zu Favoriten hinzugefügt" : "Von Favoriten entfernt", "heart");
    if (showOnlyFavorites) renderGames(currentQuery());
  });

  /* ------------------------------------------------------------------ */
  /* Einstellungen-Modal                                                  */
  /* ------------------------------------------------------------------ */
  const settingsButton = document.getElementById("settings-button");
  const settingsModal = document.getElementById("settings-modal");
  const settingsModalBackdrop = document.getElementById("settings-modal-backdrop");
  const settingsModalClose = document.getElementById("settings-modal-close");
  const settingsIconGear = document.getElementById("settings-icon-gear");
  const settingsIconClose = document.getElementById("settings-icon-close");
  const themeSegmented = document.getElementById("theme-segmented");
  const soundToggle = document.getElementById("sound-toggle");
  const vibrationToggle = document.getElementById("vibration-toggle");
  const updateCheckButton = document.getElementById("update-check-button");
  const clearCacheButton = document.getElementById("clear-cache-button");

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function syncThemeButtons(theme) {
    themeSegmented.querySelectorAll(".m3-segmented__option").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === theme));
    });
  }

  function setSettingsIcon(open) {
    settingsIconGear.style.opacity = open ? "0" : "1";
    settingsIconGear.style.transform = open ? "rotate(90deg) scale(0.7)" : "none";
    settingsIconClose.style.opacity = open ? "1" : "0";
    settingsIconClose.style.transform = open ? "none" : "rotate(-90deg) scale(0.7)";
  }

  function openSettingsModal() {
    const settings = Storage.getSettings();
    syncThemeButtons(settings.theme);
    soundToggle.checked = settings.soundEnabled;
    vibrationToggle.checked = settings.vibrationEnabled;
    settingsModal.hidden = false;
    setSettingsIcon(true);
  }

  function closeSettingsModal() {
    settingsModal.hidden = true;
    setSettingsIcon(false);
  }

  settingsButton.addEventListener("click", () => {
    if (settingsModal.hidden) openSettingsModal();
    else closeSettingsModal();
  });
  settingsModalClose.addEventListener("click", closeSettingsModal);
  settingsModalBackdrop.addEventListener("click", closeSettingsModal);

  themeSegmented.addEventListener("click", (event) => {
    const button = event.target.closest(".m3-segmented__option");
    if (!button) return;
    const theme = button.dataset.value;
    Storage.setSettings({ theme });
    applyTheme(theme);
    syncThemeButtons(theme);
  });

  soundToggle.addEventListener("change", () => {
    Storage.setSettings({ soundEnabled: soundToggle.checked });
  });

  vibrationToggle.addEventListener("change", () => {
    Storage.setSettings({ vibrationEnabled: vibrationToggle.checked });
  });

  updateCheckButton.addEventListener("click", async () => {
    updateCheckButton.disabled = true;
    updateCheckButton.textContent = "Suche…";
    const result = await CacheTools.checkForUpdate();
    updateCheckButton.disabled = false;
    updateCheckButton.textContent = "Nach Updates suchen";

    if (!result.supported) {
      Toast.show("Updates werden hier nicht unterstützt", "alert-triangle");
    } else if (result.updateFound) {
      Toast.show("Update gefunden – Banner erscheint gleich", "check");
    } else {
      Toast.show("Du hast bereits die neueste Version", "check");
    }
  });

  clearCacheButton.addEventListener("click", async () => {
    clearCacheButton.disabled = true;
    clearCacheButton.textContent = "Wird geleert…";
    try {
      await CacheTools.clearAll();
      Toast.show("Cache geleert – lädt neu…", "check");
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      clearCacheButton.disabled = false;
      clearCacheButton.textContent = "Cache löschen";
      Toast.show("Cache konnte nicht geleert werden", "alert-triangle");
    }
  });

  const appVersionLabel = document.getElementById("app-version-label");
  if (appVersionLabel && window.APP_VERSION) {
    appVersionLabel.textContent = `ANNA · v${window.APP_VERSION}`;
  }

  renderGames("");
})();
