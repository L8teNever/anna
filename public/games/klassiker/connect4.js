/**
 * 4 Gewinnt – Scheiben in Spalten fallen lassen, wer zuerst vier in einer
 * Reihe/Spalte/Diagonale hat, gewinnt. Registriert sich als Untergame im
 * Klassiker-Hub (siehe klassiker.js für die Plugin-Schnittstelle).
 */
(function () {
  const ROWS = 6;
  const COLS = 7;
  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const PLAYER_NAMES = { R: "Rot", G: "Gelb" };

  function mount(container) {
    let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let current = "R";
    let winner = null;
    let winCells = [];
    const wins = { R: 0, G: 0 };

    container.innerHTML = `
      <p class="klassiker-scoreline" id="c4-score">Rot: 0 · Gelb: 0</p>
      <p class="klassiker-status" id="c4-status"></p>
      <div class="c4-board" id="c4-board" style="--c4-cols: ${COLS}"></div>
      <button type="button" class="m3-button m3-button--filled" id="c4-restart" style="width: 100%; margin-top: 20px">
        Neue Runde
      </button>
    `;

    const scoreEl = container.querySelector("#c4-score");
    const statusEl = container.querySelector("#c4-status");
    const boardEl = container.querySelector("#c4-board");
    const restartBtn = container.querySelector("#c4-restart");

    function lowestEmptyRow(col) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!board[r][col]) return r;
      }
      return -1;
    }

    function findWin(row, col) {
      const player = board[row][col];
      for (const [dr, dc] of DIRECTIONS) {
        const cells = [[row, col]];
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
          cells.push([r, c]);
          r += dr;
          c += dc;
        }
        r = row - dr;
        c = col - dc;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
          cells.push([r, c]);
          r -= dr;
          c -= dc;
        }
        if (cells.length >= 4) return cells;
      }
      return null;
    }

    function isWinCell(row, col) {
      return winCells.some(([wr, wc]) => wr === row && wc === col);
    }

    function render() {
      boardEl.innerHTML = "";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const val = board[r][c];
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "c4-cell" + (val ? ` c4-cell--${val}` : "") + (isWinCell(r, c) ? " c4-cell--win" : "");
          cell.dataset.col = String(c);
          boardEl.appendChild(cell);
        }
      }

      if (winner) {
        statusEl.textContent = `${PLAYER_NAMES[winner]} hat gewonnen! 🎉`;
      } else if (board.every((row) => row.every(Boolean))) {
        statusEl.textContent = "Unentschieden!";
      } else {
        statusEl.textContent = `${PLAYER_NAMES[current]} ist dran`;
      }
      scoreEl.textContent = `Rot: ${wins.R} · Gelb: ${wins.G}`;
    }

    function handleBoardClick(event) {
      const cell = event.target.closest(".c4-cell");
      if (!cell || winner) return;
      const col = Number(cell.dataset.col);
      const row = lowestEmptyRow(col);
      if (row === -1) {
        Toast.show("Diese Spalte ist voll", "alert-triangle");
        return;
      }

      board[row][col] = current;
      const win = findWin(row, col);
      if (win) {
        winner = current;
        winCells = win;
        wins[winner] += 1;
        Sound.success();
        if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(30);
      } else if (board.every((r) => r.every(Boolean))) {
        Sound.beep(420, 0.15);
      } else {
        current = current === "R" ? "G" : "R";
        Sound.tick(current === "R" ? 620 : 500);
      }
      render();
    }

    function restart() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      current = "R";
      winner = null;
      winCells = [];
      render();
    }

    boardEl.addEventListener("click", handleBoardClick);
    restartBtn.addEventListener("click", restart);

    render();

    return {
      teardown() {
        boardEl.removeEventListener("click", handleBoardClick);
        restartBtn.removeEventListener("click", restart);
      },
    };
  }

  window.KlassikerGames = window.KlassikerGames || [];
  window.KlassikerGames.push({
    id: "connect4",
    name: "4 Gewinnt",
    icon: "connect4",
    color: "teal",
    description: "Scheiben fallen lassen, vier in einer Reihe gewinnen.",
    players: "2 Spieler",
    mount,
  });
})();
