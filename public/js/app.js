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

  let banners = {};
  let bannerConfig = {};
  try {
    const cached = Storage.getBanners();
    if (cached) {
      if (cached.banners) {
        banners = cached.banners;
        bannerConfig = cached.config || {};
      } else {
        banners = cached;
      }
    }
  } catch (e) {}

  async function loadBanners() {
    try {
      const res = await fetch("/api/banners");
      if (res.ok) {
        const data = await res.json();
        banners = data.banners || {};
        bannerConfig = data.config || {};
        Storage.setBanners({ banners, config: bannerConfig });
        renderGames(currentQuery());
      }
    } catch (e) {
      console.log("[anna] Offline or error loading banners, using cached banners.");
    }
  }
  loadBanners();

  /* ------------------------------------------------------------------ */
  /* Rendering                                                            */
  /* ------------------------------------------------------------------ */
  function matchesPlayerFilter(game) {
    if (activePlayerFilter === "all") return true;
    if (activePlayerFilter === "8") return game.maxPlayers >= 8;
    const count = parseInt(activePlayerFilter, 10);
    return game.minPlayers <= count && game.maxPlayers >= count;
  }

  function isOffline() {
    return typeof navigator !== "undefined" && navigator.onLine === false;
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
      const disabled = game.requiresOnline && isOffline();
      const card = document.createElement("a");
      card.className = disabled ? "game-card game-card--disabled" : "m3-card--interactive game-card";
      card.dataset.color = game.color;
      
      const bannerUrl = banners[game.id];
      card.href = game.href || `/${game.id}`;
      card.setAttribute("aria-label", disabled ? `${game.name} – offline nicht verfügbar` : `${game.name} öffnen`);
      if (disabled) card.setAttribute("aria-disabled", "true");
      card.innerHTML = `
        <div class="game-card__icon"><svg class="m3-icon"><use href="#icon-${game.icon}"></use></svg></div>
        <div class="game-card__meta">
          <span class="game-card__label">${game.tag}</span>
          <h2 class="game-card__title">${game.name}</h2>
          <span class="game-card__sub">${disabled ? "Offline nicht verfügbar – braucht Internet" : game.description}</span>
        </div>
        <div class="game-card__actions">
          ${disabled ? "" : `<span class="game-card__badge">${game.minPlayers}–${game.maxPlayers} Spieler</span>`}
          <button type="button" class="game-card__fav" data-fav-id="${game.id}" aria-pressed="${isFav}" aria-label="Favorit" title="Favorit">
            <svg class="m3-icon"><use href="#icon-heart"></use></svg>
          </button>
        </div>
      `;

      // Muss NACH card.innerHTML gesetzt werden - innerHTML ersetzt sonst
      // alle Kind-Elemente und würde diesen Banner-Layer sofort wieder
      // entfernen (war der Bug: Banner wurde erzeugt, aber nie sichtbar).
      if (bannerUrl) {
        card.classList.add("game-card--has-banner");
        const pos = (bannerConfig[game.id] && bannerConfig[game.id].position) || "center 50%";
        const zoom = (bannerConfig[game.id] && bannerConfig[game.id].zoom) || 1.0;

        const bgDiv = document.createElement("div");
        bgDiv.className = "game-card__banner-bg";
        bgDiv.style.backgroundImage = `url('${bannerUrl}')`;
        bgDiv.style.backgroundPosition = pos;
        bgDiv.style.transform = `scale(${zoom})`;
        card.appendChild(bgDiv);
      }

      // Klick + flüssiger Übergang übernimmt jetzt router.js zentral für
      // jeden internen <a>-Link (siehe grid-Klick-Handler weiter unten für
      // die Sonderbehandlung ausgegrauter Karten).
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
    if (favButton) {
      event.stopPropagation();
      event.preventDefault(); // Verhindert Navigation über den <a>-Eltern-Link
      const favorites = Storage.toggleFavorite(favButton.dataset.favId);
      const isFav = favorites.includes(favButton.dataset.favId);
      favButton.setAttribute("aria-pressed", String(isFav));
      Toast.show(isFav ? "Zu Favoriten hinzugefügt" : "Von Favoriten entfernt", "heart");
      if (showOnlyFavorites) renderGames(currentQuery());
      return;
    }

    const disabledCard = event.target.closest(".game-card--disabled");
    if (disabledCard) {
      event.stopPropagation();
      event.preventDefault();
      Toast.show("Für den Online-Modus wird eine Internetverbindung benötigt", "alert-triangle");
    }
  });

  /* ------------------------------------------------------------------ */
  /* Online-/Offline-Status: ausgegraute Karten live aktualisieren         */
  /* ------------------------------------------------------------------ */
  window.addEventListener("online", () => renderGames(currentQuery()), { signal: Router.signal });
  window.addEventListener("offline", () => renderGames(currentQuery()), { signal: Router.signal });

  renderGames("");
})();
