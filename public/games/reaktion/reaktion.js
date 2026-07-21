/**
 * Reaktionsspiele – Hub für eine wachsende Sammlung kleiner Reaktions- und
 * Präzisionsspiele (Reflextest, Zeitgefühl, ...). Gleiche Plugin-
 * Architektur wie beim Klassiker-Hub (siehe klassiker.js), damit künftige
 * Untergames NUR ein neues <eigenname>.js/<eigenname>.css-Paar brauchen,
 * ohne diese Datei hier anzufassen:
 *
 *   window.ReaktionGames.push({
 *     id: "eindeutige-id",
 *     name: "Anzeigename",
 *     icon: "icon-name",           // muss in icons.js existieren
 *     description: "Kurzer Teasertext für die Hub-Kachel",
 *     players: "1+ Spieler",       // Badge-Text auf der Kachel
 *     mount(container) {
 *       // Baut das komplette Spiel-UI in `container` auf, verdrahtet
 *       // eigene Listener direkt auf Elementen innerhalb von `container`.
 *       // Muss ein Controller-Objekt mit teardown() zurückgeben, das
 *       // beim Verlassen des Untergames aufgerufen wird (Timer stoppen
 *       // o.ä.) - container.innerHTML wird danach ohnehin geleert,
 *       // teardown() ist nur für Dinge AUSSERHALB des Containers nötig.
 *       return { teardown() {} };
 *     },
 *   });
 *
 * Die Reihenfolge der <script>-Includes in index.html bestimmt die
 * Reihenfolge der Kacheln im Hub (siehe dort).
 */
(function () {
  const backButton = document.getElementById("back-button");
  const titleEl = document.getElementById("reaktion-title");
  const hubView = document.getElementById("hub-view");
  const subgameView = document.getElementById("subgame-view");
  const hubGrid = document.getElementById("reaktion-hub-grid");
  const stage = document.getElementById("reaktion-subgame-stage");

  const games = window.ReaktionGames || [];
  let activeController = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  function renderHub() {
    if (!games.length) {
      hubGrid.innerHTML = `<p class="m3-body player-picker__empty">Noch keine Untergames verfügbar.</p>`;
      return;
    }
    hubGrid.innerHTML = games
      .map((game) => `
        <button type="button" class="m3-card--interactive game-card" data-subgame-id="${escapeHtml(game.id)}" data-color="${escapeHtml(game.color || "green")}">
          <div class="game-card__icon"><svg class="m3-icon"><use href="#icon-${escapeHtml(game.icon)}"></use></svg></div>
          <div class="game-card__meta">
            <span class="game-card__label">Reaktion</span>
            <h2 class="game-card__title">${escapeHtml(game.name)}</h2>
            <span class="game-card__sub">${escapeHtml(game.description || "")}</span>
          </div>
          <div class="game-card__actions">
            <span class="game-card__badge">${escapeHtml(game.players || "1+ Spieler")}</span>
          </div>
        </button>
      `)
      .join("");
  }

  function openSubgame(id) {
    const game = games.find((g) => g.id === id);
    if (!game) return;

    stage.innerHTML = "";
    activeController = game.mount(stage) || null;
    titleEl.textContent = game.name;
    ViewNav.transition(hubView, subgameView);
  }

  function closeSubgame() {
    if (activeController && typeof activeController.teardown === "function") {
      activeController.teardown();
    }
    activeController = null;
    stage.innerHTML = "";
    titleEl.textContent = "Reaktionsspiele";
  }

  hubGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-subgame-id]");
    if (!card) return;
    openSubgame(card.dataset.subgameId);
  });

  backButton.addEventListener("click", () => {
    if (!subgameView.hidden) {
      closeSubgame();
      ViewNav.transition(subgameView, hubView);
      return;
    }
    PageTransition.navigate("/");
  });

  // Kein Zwischenstand, der beim Verlassen "verloren" gehen könnte (nur
  // persönliche Bestzeiten für die aktuelle Sitzung) - Zurück-Geste braucht
  // deshalb keine Bestätigung.
  window.confirmGameExit = function () {
    return true;
  };

  renderHub();
  Router.onTeardown(closeSubgame);
})();
