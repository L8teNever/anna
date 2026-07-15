/**
 * Gemeinsame Wort-Kategorie-Auswahl für Spiele, die mit Kategorien +
 * Begriffen arbeiten (aktuell Bombe, Impostor). Lädt die eingebauten
 * Kategorien aus einer categories.json (siehe games/<id>/README.md) UND
 * verwaltet zusätzlich eigene, selbst angelegte Kategorien – rein in
 * localStorage (also unabhängig von der JSON-Datei und vom Service-Worker-
 * Cache, bleibt also auch nach einem App-Update oder "Cache löschen"
 * erhalten, siehe storage.js).
 *
 * Rendert in die feste Vollbild-Ansicht "Kategorien" jeder Spielseite
 * (IDs: categories-pool, category-select-summary, category-bulk-all/none).
 * Das Erstellen/Bearbeiten-Dialogfenster wird bei Bedarf selbst ins
 * <body> injiziert.
 *
 * Nutzung: const picker = CategoryPicker.create("bombe", "/games/bombe/categories.json");
 *          picker.getSelectedCategories() // -> [{id, label, icon, desc, words}, ...]
 */
(function (root) {
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function makeCustomId() {
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function parseWordsInput(raw) {
    return raw
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter(Boolean);
  }

  function ensureModal() {
    let modal = document.getElementById("category-edit-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "category-edit-modal";
    modal.className = "m3-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="m3-modal__backdrop" data-cat-modal-backdrop></div>
      <div class="m3-modal__dialog">
        <h3 class="m3-modal__title">
          <svg class="m3-icon" style="width: 18px; height: 18px; color: var(--m3-primary)"><use href="#icon-add"></use></svg>
          <span id="category-modal-title-text">Eigene Kategorie</span>
        </h3>
        <div style="display: flex; gap: 8px">
          <input type="text" id="category-modal-icon" maxlength="4" placeholder="⭐" class="m3-text-input" style="width: 64px; text-align: center; flex-shrink: 0" />
          <input type="text" id="category-modal-label" placeholder="Name der Kategorie" class="m3-text-input" maxlength="30" />
        </div>
        <input type="text" id="category-modal-desc" placeholder="Kurze Beschreibung (optional)" class="m3-text-input" maxlength="60" />
        <textarea id="category-modal-words" class="m3-textarea" placeholder="Wörter – eins pro Zeile oder mit Komma getrennt"></textarea>
        <div class="m3-modal__actions">
          <button type="button" class="m3-button m3-button--text" data-cat-modal-cancel>Abbrechen</button>
          <button type="button" class="m3-button m3-button--filled" data-cat-modal-save>Speichern</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function create(gameId, categoriesUrl) {
    const CATS_KEY = `anna:${gameId}:categories`;
    const CUSTOM_KEY = `anna:${gameId}:custom-categories`;

    let builtIn = [];
    let custom = loadCustom();
    let selectedIds = new Set();
    let editingId = null;

    const poolEl = document.getElementById("categories-pool");
    const summaryEl = document.getElementById("category-select-summary");
    const bulkAllBtn = document.getElementById("category-bulk-all");
    const bulkNoneBtn = document.getElementById("category-bulk-none");

    const modal = ensureModal();
    const modalTitleText = document.getElementById("category-modal-title-text");
    const modalIconInput = document.getElementById("category-modal-icon");
    const modalLabelInput = document.getElementById("category-modal-label");
    const modalDescInput = document.getElementById("category-modal-desc");
    const modalWordsInput = document.getElementById("category-modal-words");

    function loadCustom() {
      try {
        const stored = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
        return Array.isArray(stored) ? stored : [];
      } catch {
        return [];
      }
    }
    function saveCustom() {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    }

    function allCategories() {
      return [...builtIn, ...custom];
    }

    function loadSelected() {
      try {
        const stored = JSON.parse(localStorage.getItem(CATS_KEY));
        if (Array.isArray(stored) && stored.length) return new Set(stored);
      } catch {}
      return new Set(allCategories().map((c) => c.id));
    }
    function saveSelected() {
      localStorage.setItem(CATS_KEY, JSON.stringify([...selectedIds]));
    }

    function updateSummary() {
      if (!summaryEl) return;
      const total = allCategories().length;
      if (!total) {
        summaryEl.textContent = "Kategorien werden geladen…";
      } else if (selectedIds.size === total) {
        summaryEl.textContent = "Alle Kategorien aktiv";
      } else if (selectedIds.size === 0) {
        summaryEl.textContent = "Keine Kategorie aktiv";
      } else {
        summaryEl.textContent = `${selectedIds.size} von ${total} aktiv`;
      }
    }

    function render() {
      if (!poolEl) return;

      const rows = allCategories()
        .map((cat) => {
          const wordCount = Array.isArray(cat.words) ? cat.words.length : 0;
          const checked = selectedIds.has(cat.id) ? "checked" : "";
          const descText = cat.desc ? `${escapeHtml(cat.desc)} · ` : "";
          const customBadge = cat.custom ? '<span class="category-row__custom-tag">eigene</span>' : "";
          const customActions = cat.custom
            ? `
              <button type="button" class="m3-icon-button" data-action="edit" data-id="${cat.id}" aria-label="${escapeHtml(cat.label)} bearbeiten">
                <svg class="m3-icon" style="width: 18px; height: 18px"><use href="#icon-edit"></use></svg>
              </button>
              <button type="button" class="m3-icon-button" data-action="delete" data-id="${cat.id}" aria-label="${escapeHtml(cat.label)} löschen">
                <svg class="m3-icon" style="width: 18px; height: 18px"><use href="#icon-close"></use></svg>
              </button>
            `
            : "";

          return `
            <div class="category-row" data-id="${cat.id}">
              <div class="category-row__text">
                <span class="category-row__title">${cat.icon || "⭐"} ${escapeHtml(cat.label)}${customBadge}</span>
                <span class="category-row__desc">${descText}${wordCount} Wörter</span>
              </div>
              <div class="category-row__actions">
                ${customActions}
                <label class="m3-switch">
                  <input type="checkbox" class="category-row__checkbox" data-id="${cat.id}" ${checked} />
                  <span class="m3-switch__track"></span>
                </label>
              </div>
            </div>
          `;
        })
        .join("");

      poolEl.innerHTML = `
        ${rows}
        <button type="button" class="picker-launch-btn" data-action="create">
          <div class="picker-launch-btn__left">
            <div class="picker-launch-btn__icon"><svg class="m3-icon"><use href="#icon-add"></use></svg></div>
            <p class="picker-launch-btn__title">Eigene Kategorie erstellen</p>
          </div>
        </button>
      `;
      updateSummary();
    }

    poolEl.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".category-row__checkbox");
      if (!checkbox) return;
      const id = checkbox.dataset.id;
      if (checkbox.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      saveSelected();
      updateSummary();
    });

    poolEl.addEventListener("click", (event) => {
      const createBtn = event.target.closest('[data-action="create"]');
      if (createBtn) {
        openModal(null);
        return;
      }
      const editBtn = event.target.closest('[data-action="edit"]');
      if (editBtn) {
        openModal(editBtn.dataset.id);
        return;
      }
      const deleteBtn = event.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        deleteCustomCategory(deleteBtn.dataset.id);
      }
    });

    if (bulkAllBtn) {
      bulkAllBtn.addEventListener("click", () => {
        selectedIds = new Set(allCategories().map((c) => c.id));
        saveSelected();
        render();
      });
    }

    if (bulkNoneBtn) {
      bulkNoneBtn.addEventListener("click", () => {
        selectedIds = new Set();
        saveSelected();
        render();
      });
    }

    /* ---------------------------------------------------------------- */
    /* Eigene Kategorie erstellen / bearbeiten / löschen                    */
    /* ---------------------------------------------------------------- */
    function openModal(id) {
      editingId = id;
      const existing = id ? custom.find((c) => c.id === id) : null;
      modalTitleText.textContent = existing ? "Kategorie bearbeiten" : "Eigene Kategorie";
      modalIconInput.value = existing ? existing.icon || "" : "";
      modalLabelInput.value = existing ? existing.label : "";
      modalDescInput.value = existing ? existing.desc || "" : "";
      modalWordsInput.value = existing && Array.isArray(existing.words) ? existing.words.join("\n") : "";
      modal.hidden = false;
      setTimeout(() => modalLabelInput.focus(), 50);
    }

    function closeModal() {
      modal.hidden = true;
      editingId = null;
    }

    function saveModal() {
      const label = modalLabelInput.value.trim();
      const words = parseWordsInput(modalWordsInput.value);
      if (!label) {
        if (window.Toast) Toast.show("Bitte einen Namen eingeben", "alert-triangle");
        modalLabelInput.focus();
        return;
      }
      if (!words.length) {
        if (window.Toast) Toast.show("Bitte mindestens ein Wort eingeben", "alert-triangle");
        modalWordsInput.focus();
        return;
      }

      const icon = modalIconInput.value.trim() || "⭐";
      const desc = modalDescInput.value.trim();

      if (editingId) {
        custom = custom.map((c) => (c.id === editingId ? { ...c, label, icon, desc, words } : c));
      } else {
        const id = makeCustomId();
        custom.push({ id, label, icon, desc, words, custom: true });
        selectedIds.add(id);
        saveSelected();
      }
      saveCustom();
      closeModal();
      render();
      if (window.Toast) Toast.show(`„${label}“ gespeichert`, "check");
    }

    function deleteCustomCategory(id) {
      custom = custom.filter((c) => c.id !== id);
      saveCustom();
      selectedIds.delete(id);
      saveSelected();
      render();
    }

    modal.querySelector("[data-cat-modal-save]").addEventListener("click", saveModal);
    modal.querySelector("[data-cat-modal-cancel]").addEventListener("click", closeModal);
    modal.querySelector("[data-cat-modal-backdrop]").addEventListener("click", closeModal);

    /* ---------------------------------------------------------------- */
    /* Initiales Laden der eingebauten Kategorien aus der JSON-Datei        */
    /* ---------------------------------------------------------------- */
    async function init() {
      try {
        const response = await fetch(categoriesUrl, { cache: "no-store" });
        const data = await response.json();
        if (Array.isArray(data)) builtIn = data;
      } catch (err) {
        builtIn = [];
      }
      selectedIds = loadSelected();
      render();
    }
    init();

    function getSelectedCategories() {
      return allCategories().filter((c) => selectedIds.has(c.id));
    }

    return { getSelectedCategories };
  }

  root.CategoryPicker = { create };
})(window);
