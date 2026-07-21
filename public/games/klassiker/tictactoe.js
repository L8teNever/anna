/**
 * Tic Tac Toe – klassisches 3x3-Duell, abwechselnd auf einem Gerät.
 * Registriert sich als Untergame im Klassiker-Hub (siehe klassiker.js für
 * die Plugin-Schnittstelle).
 */
(function () {
  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  const WIN_WAVE_COLORS = {
    X: { light: "#64b5f6", mid: "#0b57cf", dark: "#062d68" },
    O: { light: "#ce93d8", mid: "#6a1b9a", dark: "#2e0a44" },
  };

  function mount(container) {
    let board = Array(9).fill(null);
    let current = "X";
    let winner = null;
    let winLine = null;
    const wins = { X: 0, O: 0 };

    container.innerHTML = `
      <p class="klassiker-scoreline" id="ttt-score">X: 0 · O: 0</p>
      <p class="klassiker-status" id="ttt-status"></p>
      <div class="ttt-board" id="ttt-board"></div>
      <button type="button" class="m3-button m3-button--filled" id="ttt-restart" style="width: 100%; margin-top: 20px">
        Neue Runde
      </button>
    `;

    const scoreEl = container.querySelector("#ttt-score");
    const statusEl = container.querySelector("#ttt-status");
    const boardEl = container.querySelector("#ttt-board");
    const restartBtn = container.querySelector("#ttt-restart");

    // Zellen werden NUR einmal gebaut - jeder Zug aktualisiert danach
    // gezielt nur die betroffene Zelle, statt das ganze Brett neu zu
    // rendern (das sorgte vorher für einen kurzen Layout-Sprung bei jedem
    // Zug, weil alle 9 Buttons jedes Mal komplett neu erzeugt wurden).
    function buildBoard() {
      boardEl.innerHTML = "";
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "ttt-cell";
        cell.dataset.idx = String(i);
        boardEl.appendChild(cell);
      }
    }

    function checkWinner() {
      for (const line of WIN_LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
          return { player: board[a], line };
        }
      }
      return null;
    }

    function updateStatus() {
      if (winner) {
        statusEl.textContent = `${winner} hat gewonnen! 🎉`;
        container.dataset.tint = winner === "X" ? "ttt-x" : "ttt-o";
      } else if (board.every(Boolean)) {
        statusEl.textContent = "Unentschieden!";
        delete container.dataset.tint;
      } else {
        statusEl.textContent = `${current} ist dran`;
        container.dataset.tint = current === "X" ? "ttt-x" : "ttt-o";
      }
      scoreEl.textContent = `X: ${wins.X} · O: ${wins.O}`;
    }

    function handleCellClick(event) {
      const btn = event.target.closest("[data-idx]");
      if (!btn || winner) return;
      const idx = Number(btn.dataset.idx);
      if (board[idx]) return;

      board[idx] = current;
      btn.textContent = current;
      btn.dataset.mark = current;
      btn.disabled = true;
      // Reflow erzwingen, damit die Pop-Animation bei jeder neuen Zelle
      // zuverlässig von vorne startet (Klasse einfach neu setzen reicht
      // sonst nicht, falls sie zufällig schon dranhängt).
      btn.classList.remove("ttt-cell--pop");
      void btn.offsetWidth;
      btn.classList.add("ttt-cell--pop");

      const result = checkWinner();
      if (result) {
        winner = result.player;
        winLine = result.line;
        wins[winner] += 1;
        winLine.forEach((i) => boardEl.children[i].classList.add("ttt-cell--win"));
        Sound.success();
        if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(30);
        if (window.KlassikerHub) {
          window.KlassikerHub.playWinWave({
            ...WIN_WAVE_COLORS[winner],
            label: `${winner} hat gewonnen! 🎉`,
          });
        }
      } else if (board.every(Boolean)) {
        Sound.beep(420, 0.15);
      } else {
        current = current === "X" ? "O" : "X";
        Sound.tick(current === "X" ? 620 : 500);
      }
      updateStatus();
    }

    function restart() {
      board = Array(9).fill(null);
      current = "X";
      winner = null;
      winLine = null;
      buildBoard();
      updateStatus();
    }

    boardEl.addEventListener("click", handleCellClick);
    restartBtn.addEventListener("click", restart);

    buildBoard();
    updateStatus();

    return {
      teardown() {
        boardEl.removeEventListener("click", handleCellClick);
        restartBtn.removeEventListener("click", restart);
        delete container.dataset.tint;
      },
    };
  }

  window.KlassikerGames = window.KlassikerGames || [];
  window.KlassikerGames.push({
    id: "tictactoe",
    name: "Tic Tac Toe",
    icon: "tictactoe",
    color: "purple",
    description: "Drei in eine Reihe, Spalte oder Diagonale.",
    players: "2 Spieler",
    mount,
  });
})();
