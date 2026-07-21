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
  const WIN_WAVE_COLORS = {
    R: { light: "#ff8a80", mid: "#e53935", dark: "#5c0f0f" },
    G: { light: "#fff59d", mid: "#fdd835", dark: "#6b5900" },
  };

  function mount(container) {
    let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let current = "R";
    let winner = null;
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

    // Zellen werden NUR einmal gebaut - jeder Zug aktualisiert danach
    // gezielt nur die eine neue Scheibe (statt das ganze Brett neu zu
    // rendern), sonst würde die Fall-Animation unten bei jedem Zug auf
    // ALLEN bereits liegenden Scheiben erneut abspielen.
    function buildBoard() {
      boardEl.innerHTML = "";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "c4-cell";
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
          boardEl.appendChild(cell);
        }
      }
    }

    function cellAt(row, col) {
      return boardEl.children[row * COLS + col];
    }

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

    // Scheibe fällt sichtbar von oberhalb des Bretts (eine Reihe über der
    // ersten Zeile) bis zur Landeposition - Anzahl Reihen wird als CSS-
    // Variable an die c4-drop-Keyframe-Animation übergeben (siehe
    // connect4.css).
    function placeDisc(row, col, player) {
      const cell = cellAt(row, col);
      cell.classList.add(`c4-cell--${player}`);
      cell.style.setProperty("--drop-rows", String(row + 1));
      cell.classList.remove("c4-cell--dropping");
      void cell.offsetWidth;
      cell.classList.add("c4-cell--dropping");
    }

    function updateStatus() {
      const isDraw = !winner && board.every((row) => row.every(Boolean));
      if (winner) {
        statusEl.textContent = `${PLAYER_NAMES[winner]} hat gewonnen! 🎉`;
        container.dataset.tint = winner === "R" ? "c4-r" : "c4-g";
      } else if (isDraw) {
        statusEl.textContent = "Unentschieden!";
        delete container.dataset.tint;
      } else {
        statusEl.textContent = `${PLAYER_NAMES[current]} ist dran`;
        container.dataset.tint = current === "R" ? "c4-r" : "c4-g";
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
      placeDisc(row, col, current);

      const win = findWin(row, col);
      if (win) {
        winner = current;
        wins[winner] += 1;
        win.forEach(([wr, wc]) => cellAt(wr, wc).classList.add("c4-cell--win"));
        Sound.success();
        if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(30);
        if (window.KlassikerHub) {
          window.KlassikerHub.playWinWave({
            ...WIN_WAVE_COLORS[winner],
            label: `${PLAYER_NAMES[winner]} hat gewonnen! 🎉`,
          });
        }
      } else if (board.every((r) => r.every(Boolean))) {
        Sound.beep(420, 0.15);
      } else {
        current = current === "R" ? "G" : "R";
        Sound.tick(current === "R" ? 620 : 500);
      }
      updateStatus();
    }

    function restart() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      current = "R";
      winner = null;
      buildBoard();
      updateStatus();
    }

    boardEl.addEventListener("click", handleBoardClick);
    restartBtn.addEventListener("click", restart);

    buildBoard();
    updateStatus();

    return {
      teardown() {
        boardEl.removeEventListener("click", handleBoardClick);
        restartBtn.removeEventListener("click", restart);
        delete container.dataset.tint;
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
