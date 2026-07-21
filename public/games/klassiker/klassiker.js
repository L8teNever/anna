/**
 * Klassiker – Hub für eine wachsende Sammlung von Brettspiel-Klassikern
 * (Tic Tac Toe, 4 Gewinnt, ...). Bewusst als Plugin-Architektur gebaut,
 * damit künftige Untergames NUR ein neues <eigenname>.js/<eigenname>.css-
 * Paar brauchen, ohne diese Datei hier anzufassen:
 *
 *   window.KlassikerGames.push({
 *     id: "eindeutige-id",
 *     name: "Anzeigename",
 *     icon: "icon-name",           // muss in icons.js existieren
 *     description: "Kurzer Teasertext für die Hub-Kachel",
 *     players: "2 Spieler",        // Badge-Text auf der Kachel
 *     mount(container) {
 *       // Baut das komplette Spiel-UI in `container` auf, verdrahtet
 *       // eigene Listener direkt auf Elementen innerhalb von `container`.
 *       // Muss ein Controller-Objekt mit teardown() zurückgeben, das
 *       // beim Verlassen des Untergames aufgerufen wird (Listener lösen,
 *       // Timer stoppen o.ä.) - container.innerHTML wird danach ohnehin
 *       // geleert, teardown() ist nur für Dinge AUSSERHALB des Containers
 *       // nötig (z.B. window/document-Listener).
 *       return { teardown() {} };
 *     },
 *   });
 *
 * Die Reihenfolge der <script>-Includes in index.html bestimmt die
 * Reihenfolge der Kacheln im Hub (siehe dort).
 */
(function () {
  const backButton = document.getElementById("back-button");
  const titleEl = document.getElementById("klassiker-title");
  const hubView = document.getElementById("hub-view");
  const subgameView = document.getElementById("subgame-view");
  const hubGrid = document.getElementById("klassiker-hub-grid");
  const stage = document.getElementById("klassiker-subgame-stage");

  const games = window.KlassikerGames || [];
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
        <button type="button" class="m3-card--interactive game-card" data-subgame-id="${escapeHtml(game.id)}" data-color="${escapeHtml(game.color || "amber")}">
          <div class="game-card__icon"><svg class="m3-icon"><use href="#icon-${escapeHtml(game.icon)}"></use></svg></div>
          <div class="game-card__meta">
            <span class="game-card__label">Klassiker</span>
            <h2 class="game-card__title">${escapeHtml(game.name)}</h2>
            <span class="game-card__sub">${escapeHtml(game.description || "")}</span>
          </div>
          <div class="game-card__actions">
            <span class="game-card__badge">${escapeHtml(game.players || "2 Spieler")}</span>
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
    titleEl.textContent = "Klassiker";
    clearWinWaveTimeouts();
  }

  /* ------------------------------------------------------------------ */
  /* Sieg-Welle (siehe Kommentar in klassiker.css) - für jedes Untergame  */
  /* nutzbar über window.KlassikerHub.playWinWave({...}), damit dieser    */
  /* Effekt nicht in jedem Untergame einzeln nachgebaut werden muss.      */
  /* ------------------------------------------------------------------ */
  const winWave = document.getElementById("klassiker-win-wave");
  const winWaveFill = winWave ? winWave.querySelector(".klassiker-win-wave__fill") : null;
  const winWaveLabel = document.getElementById("klassiker-win-wave-label");
  let winWaveTimeouts = [];

  function clearWinWaveTimeouts() {
    winWaveTimeouts.forEach((id) => clearTimeout(id));
    winWaveTimeouts = [];
  }

  // options: { light, mid, dark (CSS-Farbwerte für den Wellenverlauf), label (Text) }
  function playWinWave(options) {
    if (!winWave || !winWaveFill) return;
    const opts = options || {};
    clearWinWaveTimeouts();

    winWaveFill.style.setProperty("--win-wave-light", opts.light || "#ffd54f");
    winWaveFill.style.setProperty("--win-wave-mid", opts.mid || "#ff8f00");
    winWaveFill.style.setProperty("--win-wave-dark", opts.dark || "#7a4600");
    winWaveLabel.textContent = opts.label || "";

    winWave.classList.remove("klassiker-win-wave--falling");
    winWave.classList.add("klassiker-win-wave--rising");
    winWave.hidden = false;
    void winWave.offsetWidth; // Reflow, damit die Animation sicher neu startet

    const fallStartId = setTimeout(() => {
      winWave.classList.remove("klassiker-win-wave--rising");
      winWave.classList.add("klassiker-win-wave--falling");

      const hideId = setTimeout(() => {
        winWave.hidden = true;
        winWave.classList.remove("klassiker-win-wave--falling");
      }, 500);
      winWaveTimeouts.push(hideId);
    }, 1300);
    winWaveTimeouts.push(fallStartId);
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

  // Brettspiel-Zwischenstände sind nichts, was man beim Verlassen
  // "verlieren" könnte (anders als z.B. eine laufende Werwolf-Runde) -
  // die Android/iOS-Zurück-Geste braucht deshalb keine Bestätigung.
  window.confirmGameExit = function () {
    return true;
  };

  window.KlassikerHub = { playWinWave };

  renderHub();
  Router.onTeardown(closeSubgame);
})();
