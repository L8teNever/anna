/**
 * Kleine Toast-Benachrichtigung unten am Bildschirmrand. Erzeugt sich beim
 * ersten Aufruf selbst im DOM, damit keine Seite eigenes Markup braucht.
 */
(function (root) {
  let toastEl = null;
  let hideTimeoutId = null;

  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = "m3-toast";
    toastEl.innerHTML = `<span class="m3-toast__icon" id="m3-toast-icon"></span><span id="m3-toast-text"></span>`;
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function show(text, iconId) {
    const el = ensureToast();
    el.querySelector("#m3-toast-text").textContent = text;
    const iconEl = el.querySelector("#m3-toast-icon");
    iconEl.innerHTML = iconId
      ? `<svg class="m3-icon" style="width:18px;height:18px"><use href="#icon-${iconId}"></use></svg>`
      : "";

    clearTimeout(hideTimeoutId);
    el.classList.add("m3-toast--visible");
    hideTimeoutId = setTimeout(() => {
      el.classList.remove("m3-toast--visible");
    }, 2200);
  }

  root.Toast = { show };
})(window);
