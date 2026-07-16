/**
 * Einfacher Bestätigen/Abbrechen-Dialog, wiederverwendbar für alle Spiele
 * (z.B. "Spiel wirklich verlassen?" beim Zurück-Pfeil während eine Runde
 * läuft). Wird bei Bedarf selbst ins <body> injiziert.
 *
 * Nutzung: ConfirmDialog.show({
 *   title: "Spiel verlassen?",
 *   message: "Die laufende Runde wird abgebrochen.",
 *   confirmLabel: "Verlassen",
 *   onConfirm: () => { ... },
 * });
 */
(function (root) {
  function ensureModal() {
    let modal = document.getElementById("confirm-dialog-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "confirm-dialog-modal";
    modal.className = "m3-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="m3-modal__backdrop" data-confirm-backdrop></div>
      <div class="m3-modal__dialog" style="max-width: 320px">
        <h3 class="m3-modal__title">
          <svg class="m3-icon" style="width: 18px; height: 18px; color: var(--m3-error)"><use href="#icon-alert-triangle"></use></svg>
          <span id="confirm-dialog-title-text">Bist du sicher?</span>
        </h3>
        <p class="m3-body" id="confirm-dialog-message"></p>
        <div class="m3-modal__actions">
          <button type="button" class="m3-button m3-button--text" data-confirm-cancel>Abbrechen</button>
          <button type="button" class="m3-button m3-button--danger" id="confirm-dialog-confirm-btn">Verlassen</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function show(options) {
    const opts = options || {};
    const modal = ensureModal();
    const titleText = document.getElementById("confirm-dialog-title-text");
    const messageEl = document.getElementById("confirm-dialog-message");
    const confirmBtn = document.getElementById("confirm-dialog-confirm-btn");
    const cancelBtn = modal.querySelector("[data-confirm-cancel]");
    const backdrop = modal.querySelector("[data-confirm-backdrop]");

    titleText.textContent = opts.title || "Bist du sicher?";
    messageEl.textContent = opts.message || "";
    confirmBtn.textContent = opts.confirmLabel || "Verlassen";

    function close() {
      modal.hidden = true;
      confirmBtn.removeEventListener("click", onConfirmClick);
      cancelBtn.removeEventListener("click", close);
      backdrop.removeEventListener("click", close);
    }

    function onConfirmClick() {
      close();
      if (opts.onConfirm) opts.onConfirm();
    }

    confirmBtn.addEventListener("click", onConfirmClick);
    cancelBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);

    modal.hidden = false;
  }

  root.ConfirmDialog = { show };
})(window);
