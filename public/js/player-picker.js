/**
 * Gemeinsame Spieler-Auswahl für alle Spiele. Verwaltet EIN globales
 * Roster (siehe storage.js: Storage.getRoster/setRoster), das über alle
 * Spiele hinweg erhalten bleibt, bis ein Name umbenannt oder gelöscht
 * wird. Jedes Spiel hakt daraus nur an, wer diese Runde mitspielt
 * (gespeichert pro gameId), statt bei jedem Spiel neu Namen einzutippen.
 *
 * Nutzung: const picker = PlayerPicker.create(containerEl, "bombe");
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

  function create(container, gameId) {
    let roster = Storage.getRoster();
    let selected = new Set(Storage.getSelectedPlayers(gameId));
    let editingName = null;

    container.innerHTML = `
      <div class="player-picker__list"></div>
      <div class="player-input-row">
        <input type="text" class="player-picker__new-input" placeholder="Neuen Spieler hinzufügen…" maxlength="20" />
        <button type="button" class="m3-button m3-button--tonal player-picker__add-button" aria-label="Spieler hinzufügen">
          <svg class="m3-icon"><use href="#icon-add"></use></svg>
        </button>
      </div>
    `;

    const list = container.querySelector(".player-picker__list");
    const newInput = container.querySelector(".player-picker__new-input");
    const addButton = container.querySelector(".player-picker__add-button");

    function persistSelection() {
      Storage.setSelectedPlayers(gameId, Array.from(selected));
    }

    function render() {
      if (roster.length === 0) {
        list.innerHTML = `<p class="m3-body player-picker__empty">Noch keine Spieler – unten hinzufügen.</p>`;
        return;
      }

      list.innerHTML = roster
        .map((name) => {
          const checked = selected.has(name) ? "checked" : "";
          if (editingName === name) {
            return `
              <div class="player-row" data-name="${escapeHtml(name)}">
                <input type="text" class="player-row__rename-input" value="${escapeHtml(name)}" maxlength="20" />
              </div>
            `;
          }
          return `
            <div class="player-row" data-name="${escapeHtml(name)}">
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

      const renameInput = list.querySelector(".player-row__rename-input");
      if (renameInput) {
        renameInput.focus();
        renameInput.select();
      }
    }

    function addPlayer(rawName) {
      const name = rawName.trim();
      if (!name) return;
      if (roster.some((existing) => existing.toLowerCase() === name.toLowerCase())) return;

      roster = [...roster, name];
      Storage.setRoster(roster);
      selected.add(name);
      persistSelection();
      render();
    }

    function commitRename(oldName, rawNewName) {
      const newName = rawNewName.trim();
      editingName = null;

      if (!newName || newName === oldName) {
        render();
        return;
      }
      if (roster.some((existing) => existing !== oldName && existing.toLowerCase() === newName.toLowerCase())) {
        render();
        return;
      }

      roster = roster.map((name) => (name === oldName ? newName : name));
      Storage.setRoster(roster);
      if (selected.has(oldName)) {
        selected.delete(oldName);
        selected.add(newName);
        persistSelection();
      }
      render();
    }

    function deletePlayer(name) {
      roster = roster.filter((existing) => existing !== name);
      Storage.setRoster(roster);
      selected.delete(name);
      persistSelection();
      render();
    }

    addButton.addEventListener("click", () => {
      addPlayer(newInput.value);
      newInput.value = "";
      newInput.focus();
    });

    newInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addPlayer(newInput.value);
        newInput.value = "";
      }
    });

    list.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".player-row__checkbox");
      if (!checkbox) return;
      const name = checkbox.closest(".player-row").dataset.name;
      if (checkbox.checked) selected.add(name);
      else selected.delete(name);
      persistSelection();
    });

    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const name = button.closest(".player-row").dataset.name;

      if (button.dataset.action === "rename") {
        editingName = name;
        render();
      } else if (button.dataset.action === "delete") {
        deletePlayer(name);
      }
    });

    list.addEventListener("keydown", (event) => {
      const input = event.target.closest(".player-row__rename-input");
      if (!input) return;
      const oldName = input.closest(".player-row").dataset.name;
      if (event.key === "Enter") {
        event.preventDefault();
        commitRename(oldName, input.value);
      } else if (event.key === "Escape") {
        editingName = null;
        render();
      }
    });

    list.addEventListener(
      "blur",
      (event) => {
        const input = event.target.closest && event.target.closest(".player-row__rename-input");
        if (!input) return;
        const oldName = input.closest(".player-row").dataset.name;
        commitRename(oldName, input.value);
      },
      true
    );

    render();

    return {
      getSelectedNames() {
        return roster.filter((name) => selected.has(name));
      },
    };
  }

  root.PlayerPicker = { create };
})(window);
