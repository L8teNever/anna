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

    function checkWinner() {
      for (const line of WIN_LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
          return { player: board[a], line };
        }
      }
      return null;
    }

    function render() {
      boardEl.innerHTML = board
        .map((val, idx) => {
          const isWin = winLine && winLine.includes(idx);
          return `
            <button type="button" class="ttt-cell${isWin ? " ttt-cell--win" : ""}" data-idx="${idx}" ${val ? "disabled" : ""}>
              ${val || ""}
            </button>
          `;
        })
        .join("");

      if (winner) {
        statusEl.textContent = `${winner} hat gewonnen! 🎉`;
      } else if (board.every(Boolean)) {
        statusEl.textContent = "Unentschieden!";
      } else {
        statusEl.textContent = `${current} ist dran`;
      }
      scoreEl.textContent = `X: ${wins.X} · O: ${wins.O}`;
    }

    function handleCellClick(event) {
      const btn = event.target.closest("[data-idx]");
      if (!btn || winner) return;
      const idx = Number(btn.dataset.idx);
      if (board[idx]) return;

      board[idx] = current;
      const result = checkWinner();
      if (result) {
        winner = result.player;
        winLine = result.line;
        wins[winner] += 1;
        Sound.success();
        if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(30);
      } else if (board.every(Boolean)) {
        Sound.beep(420, 0.15);
      } else {
        current = current === "X" ? "O" : "X";
        Sound.tick(current === "X" ? 620 : 500);
      }
      render();
    }

    function restart() {
      board = Array(9).fill(null);
      current = "X";
      winner = null;
      winLine = null;
      render();
    }

    boardEl.addEventListener("click", handleCellClick);
    restartBtn.addEventListener("click", restart);

    render();

    return {
      teardown() {
        boardEl.removeEventListener("click", handleCellClick);
        restartBtn.removeEventListener("click", restart);
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
