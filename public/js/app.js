/**
 * Logik der Startseite: rendert die Spiele-Widgets aus GAMES
 * (game-registry.js), filtert live über das Suchfeld und verlinkt auf die
 * Einstellungsseite.
 */
(function () {
  const grid = document.getElementById("game-grid");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("search-input");
  const settingsButton = document.getElementById("settings-button");

  function renderGames(filterText) {
    const query = (filterText || "").trim().toLowerCase();
    const matches = window.GAMES.filter((game) => {
      if (!query) return true;
      return game.name.toLowerCase().includes(query) || game.description.toLowerCase().includes(query);
    });

    grid.innerHTML = "";
    matches.forEach((game) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "m3-card m3-card--interactive game-widget";
      card.dataset.color = game.color;
      card.setAttribute("aria-label", `${game.name} öffnen`);
      card.innerHTML = `
        <span class="game-widget__icon"><svg class="m3-icon"><use href="#icon-${game.icon}"></use></svg></span>
        <span>
          <span class="game-widget__title">${game.name}</span>
          <span class="game-widget__description">${game.description}</span>
        </span>
      `;
      card.addEventListener("click", () => {
        window.location.href = `/${game.id}`;
      });
      grid.appendChild(card);
    });

    emptyState.hidden = matches.length > 0;
  }

  searchInput.addEventListener("input", (event) => renderGames(event.target.value));
  settingsButton.addEventListener("click", () => {
    window.location.href = "/settings";
  });

  renderGames("");
})();
