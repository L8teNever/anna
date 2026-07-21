/**
 * Gemeinsame Spieler-Auswahl für alle Spiele. Verwaltet EIN globales
 * Roster UND eine gemeinsame Auswahl, wer gerade mitspielt (siehe
 * storage.js: Storage.getRoster/setRoster/getSelectedPlayers/
 * setSelectedPlayers) – bewusst NICHT pro Spiel getrennt, damit man beim
 * Wechsel zwischen Spielen dieselben Mitspieler nicht neu anhaken muss.
 *
 * Rendert in die feste Vollbild-Ansicht "Mitspieler auswählen" jeder
 * Spielseite (IDs: select-players-scroll, player-active-counter,
 * combined-player-input, create-player-inline-btn, player-bulk-all/none).
 * Das Umbenennen-Dialogfenster wird bei Bedarf selbst ins <body> injiziert.
 *
 * Nutzung: const picker = PlayerPicker.create();
 *          picker.getSelectedNames() // -> string[]
 */
(function (root) {
  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function ensureRenameModal() {
    let modal = document.getElementById("player-rename-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "player-rename-modal";
    modal.className = "m3-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="m3-modal__backdrop" data-rename-backdrop></div>
      <div class="m3-modal__dialog" style="max-width: 320px">
        <h3 class="m3-modal__title">
          <svg class="m3-icon" style="width: 18px; height: 18px; color: var(--m3-primary)"><use href="#icon-edit"></use></svg>
          Name ändern
        </h3>
        <input type="text" class="player-row__rename-input" id="rename-modal-input" maxlength="20" style="width: 100%" />
        <div class="m3-modal__actions">
          <button type="button" class="m3-button m3-button--text" data-rename-cancel>Abbrechen</button>
          <button type="button" class="m3-button m3-button--filled" data-rename-save>Speichern</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function create() {
    let roster = Storage.getRoster();
    let selected = new Set(Storage.getSelectedPlayers());
    let searchQuery = "";
    let renamingName = null;
    let changeCallback = null;

    const listEl = document.getElementById("select-players-scroll");
    const counterEl = document.getElementById("player-active-counter");
    const combinedInput = document.getElementById("combined-player-input");
    const createInlineBtn = document.getElementById("create-player-inline-btn");
    const bulkAllBtn = document.getElementById("player-bulk-all");
    const bulkNoneBtn = document.getElementById("player-bulk-none");

    const renameModal = ensureRenameModal();
    const renameInput = renameModal.querySelector("#rename-modal-input");

    function updateCounter() {
      if (counterEl) counterEl.textContent = `Aktiv: ${selected.size}`;
    }

    function persistSelection() {
      Storage.setSelectedPlayers(Array.from(selected));
      updateCounter();
      if (changeCallback) changeCallback(getSelectedNames());
    }

    function visibleRoster() {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return roster;
      return roster.filter((name) => name.toLowerCase().includes(query));
    }

    /* ------------------------------------------------------------------ */
    /* Reihenfolge per Ziehen ändern (Griff links an jeder Zeile).           */
    /* Wichtig für Spiele, die das Gerät reihum weitergeben (z.B. Impostor,  */
    /* Wer ist näher dran?) - wer oben steht, ist zuerst dran, siehe          */
    /* getSelectedNames() unten (filtert `roster` in genau dieser            */
    /* Reihenfolge). Für andere Spiele ist die Reihenfolge irrelevant, die   */
    /* Funktion stört dort also nicht, wird nur nie ausgewertet.             */
    /* ------------------------------------------------------------------ */
    let dragState = null;

    function reorderingAllowed() {
      // Während einer Suche ist nur eine gefilterte Teilmenge sichtbar -
      // Ziehen wäre dort nicht eindeutig einer Position im Gesamt-Roster
      // zuordenbar, deshalb bewusst deaktiviert (siehe
      // player-picker__list--searching in components.css).
      return !searchQuery.trim();
    }

    function startDrag(event, rowEl) {
      if (!reorderingAllowed()) return;
      event.preventDefault();
      const rect = rowEl.getBoundingClientRect();
      dragState = {
        rowEl,
        startClientY: event.clientY,
        // +6px: der Row-Gap aus .player-picker__list, damit ein "ganzer
        // Schritt" exakt einer Nachbarposition entspricht.
        rowHeight: rect.height + 6,
      };
      rowEl.classList.add("player-row--dragging");
      document.addEventListener("pointermove", onDragMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    }

    function onDragMove(event) {
      if (!dragState) return;
      const { rowEl, rowHeight } = dragState;
      const deltaY = event.clientY - dragState.startClientY;
      rowEl.style.transform = `translateY(${deltaY}px)`;

      const rows = Array.from(listEl.querySelectorAll(".player-row"));
      const currentIndex = rows.indexOf(rowEl);
      const step = Math.round(deltaY / rowHeight);
      if (step === 0) return;

      const targetIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + step));
      if (targetIndex === currentIndex) return;

      // Zeile physisch an die neue Position verschieben (statt komplett neu
      // zu rendern) - so bleibt die dragState.rowEl-Referenz und damit der
      // laufende Zieh-Vorgang gültig. Die Ziel-Verschiebung, die dadurch
      // schon "verbraucht" wurde, wird von startClientY abgezogen, damit
      // der Finger visuell nahtlos an der Zeile bleibt statt zu springen.
      const referenceNode = step > 0 ? rows[targetIndex].nextElementSibling : rows[targetIndex];
      listEl.insertBefore(rowEl, referenceNode);
      dragState.startClientY += step * rowHeight;
      rowEl.style.transform = `translateY(${deltaY - step * rowHeight}px)`;
    }

    function endDrag() {
      if (!dragState) return;
      const { rowEl } = dragState;
      rowEl.classList.remove("player-row--dragging");
      rowEl.style.transform = "";
      document.removeEventListener("pointermove", onDragMove);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);
      dragState = null;

      const newOrder = Array.from(listEl.querySelectorAll(".player-row")).map((el) => el.dataset.name);
      roster = newOrder;
      Storage.setRoster(roster);
      if (changeCallback) changeCallback(getSelectedNames());
    }

    function render() {
      if (!listEl) return;

      if (roster.length === 0) {
        listEl.innerHTML = `<p class="m3-body player-picker__empty">Noch keine Spieler – oben eintippen und Enter drücken.</p>`;
        updateCounter();
        return;
      }

      const visible = visibleRoster();
      if (visible.length === 0) {
        listEl.innerHTML = `<p class="m3-body player-picker__empty">Kein Spieler gefunden.</p>`;
        updateCounter();
        return;
      }

      listEl.classList.toggle("player-picker__list--searching", Boolean(searchQuery.trim()));

      listEl.innerHTML = visible
        .map((name) => {
          const checked = selected.has(name) ? "checked" : "";
          return `
            <div class="player-row" data-name="${escapeHtml(name)}">
              <button type="button" class="player-row__drag-handle" data-drag-handle tabindex="-1" aria-label="${escapeHtml(name)} ziehen zum Sortieren (Reihenfolge = Spielreihenfolge)">
                <svg class="m3-icon"><use href="#icon-drag-handle"></use></svg>
              </button>
              <label class="player-row__main">
                <input type="checkbox" class="player-row__checkbox" ${checked} />
                <span class="player-row__name">${escapeHtml(name)}</span>
              </label>
              <div class="player-row__actions">
                <button type="button" class="m3-icon-button" data-action="rename" aria-label="${escapeHtml(name)} umbenennen">
                  <svg class="m3-icon"><use href="#icon-edit"></use></svg>
                </button>
                <button type="button" class="m3-icon-button" data-action="delete" aria-label="${escapeHtml(name)} löschen">
                  <svg class="m3-icon"><use href="#icon-close"></use></svg>
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      updateCounter();
    }

    function addPlayer(rawName) {
      const name = rawName.trim();
      if (!name) return;
      if (roster.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
        if (window.Toast) Toast.show("Spieler existiert bereits", "alert-triangle");
        return;
      }

      roster = [...roster, name];
      Storage.setRoster(roster);
      selected.add(name);
      persistSelection();
      render();
      if (window.Toast) Toast.show(`${name} hinzugefügt`, "check");
    }

    function deletePlayer(name) {
      roster = roster.filter((existing) => existing !== name);
      Storage.setRoster(roster);
      selected.delete(name);
      persistSelection();
      render();
    }

    function openRename(name) {
      renamingName = name;
      renameInput.value = name;
      renameModal.hidden = false;
      setTimeout(() => {
        renameInput.focus();
        renameInput.select();
      }, 50);
    }

    function closeRename() {
      renameModal.hidden = true;
      renamingName = null;
    }

    function commitRename() {
      const oldName = renamingName;
      const newName = renameInput.value.trim();
      closeRename();
      if (!oldName || !newName || newName === oldName) return;
      if (roster.some((existing) => existing !== oldName && existing.toLowerCase() === newName.toLowerCase())) {
        if (window.Toast) Toast.show("Name bereits vergeben", "alert-triangle");
        return;
      }

      roster = roster.map((existing) => (existing === oldName ? newName : existing));
      Storage.setRoster(roster);
      if (selected.has(oldName)) {
        selected.delete(oldName);
        selected.add(newName);
        persistSelection();
      }
      render();
    }

    function updateInlineAddVisibility() {
      const trimmed = combinedInput.value.trim();
      const existsExactly = roster.some((existing) => existing.toLowerCase() === trimmed.toLowerCase());
      createInlineBtn.classList.toggle("picker-search-create__add--visible", trimmed.length > 0 && !existsExactly);
    }

    if (combinedInput) {
      combinedInput.addEventListener("input", () => {
        searchQuery = combinedInput.value;
        updateInlineAddVisibility();
        render();
      });

      combinedInput.addEventListener("keypress", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const trimmed = combinedInput.value.trim();
        const existsExactly = roster.some((existing) => existing.toLowerCase() === trimmed.toLowerCase());
        if (trimmed && !existsExactly) {
          addPlayer(trimmed);
          combinedInput.value = "";
          searchQuery = "";
          updateInlineAddVisibility();
          render();
          // Fokus bewusst im Feld halten (nicht nur Wert leeren) - beim
          // Eintippen mehrerer Namen hintereinander muss man so nicht nach
          // jedem Namen extra wieder reinklicken/-tippen, Tastatur bleibt
          // auf dem Handy direkt offen für den nächsten Namen.
          combinedInput.focus();
        }
      });
    }

    if (createInlineBtn) {
      createInlineBtn.addEventListener("click", () => {
        addPlayer(combinedInput.value);
        combinedInput.value = "";
        searchQuery = "";
        updateInlineAddVisibility();
        render();
        combinedInput.focus();
      });
    }

    if (listEl) {
      listEl.addEventListener("change", (event) => {
        const checkbox = event.target.closest(".player-row__checkbox");
        if (!checkbox) return;
        const name = checkbox.closest(".player-row").dataset.name;
        if (checkbox.checked) selected.add(name);
        else selected.delete(name);
        persistSelection();
      });

      listEl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const name = button.closest(".player-row").dataset.name;
        if (button.dataset.action === "rename") openRename(name);
        else if (button.dataset.action === "delete") deletePlayer(name);
      });

      listEl.addEventListener("pointerdown", (event) => {
        const handle = event.target.closest("[data-drag-handle]");
        if (!handle) return;
        const rowEl = handle.closest(".player-row");
        if (rowEl) startDrag(event, rowEl);
      });
    }

    if (bulkAllBtn) {
      bulkAllBtn.addEventListener("click", () => {
        selected = new Set(roster);
        persistSelection();
        render();
      });
    }

    if (bulkNoneBtn) {
      bulkNoneBtn.addEventListener("click", () => {
        selected = new Set();
        persistSelection();
        render();
      });
    }

    renameModal.querySelector("[data-rename-save]").addEventListener("click", commitRename);
    renameModal.querySelector("[data-rename-cancel]").addEventListener("click", closeRename);
    renameModal.querySelector("[data-rename-backdrop]").addEventListener("click", closeRename);
    renameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") commitRename();
      else if (event.key === "Escape") closeRename();
    });

    render();

    function getSelectedNames() {
      return roster.filter((name) => selected.has(name));
    }

    return {
      getSelectedNames,
      getActiveCount() {
        return selected.size;
      },
      onChange(callback) {
        changeCallback = callback;
      },
    };
  }

  root.PlayerPicker = { create };
})(window);
