/**
 * Eigener Dropdown, ersetzt natives <select> (Browser-Standard-Dropdowns
 * passen optisch nicht zum Rest der App). Menü wird bei jedem Öffnen frisch
 * ans <body> gehängt und per position:fixed anhand des Trigger-Rects
 * platziert - so wird es nie von überflow:auto-Eltern (z.B. .m3-modal__dialog)
 * abgeschnitten und bleibt auch unter Scroll/Resize korrekt positioniert.
 *
 * Nutzung:
 *   const select = CustomSelect.create(containerEl, {
 *     options: [{ value: "a", label: "A" }, ...],
 *     value: "a",
 *     placeholder: "Bitte wählen…",
 *     onChange: (value) => { ... },
 *   });
 *   select.setOptions(newOptions, newValue);
 *   select.getValue();
 */
(function (root) {
  let openClose = null;

  function closeOpen() {
    if (openClose) openClose();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  function create(container, initialOptions) {
    const opts = initialOptions || {};
    container.classList.add("m3-custom-select");
    container.innerHTML = `
      <button type="button" class="m3-custom-select__trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="m3-custom-select__value"></span>
        <svg class="m3-icon m3-custom-select__chevron"><use href="#icon-chevron-up"></use></svg>
      </button>
    `;
    const trigger = container.querySelector(".m3-custom-select__trigger");
    const valueEl = container.querySelector(".m3-custom-select__value");

    const menu = document.createElement("div");
    menu.className = "m3-custom-select__menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    document.body.appendChild(menu);

    let items = [];
    let value = opts.value != null ? opts.value : "";
    let disabled = !!opts.disabled;

    function renderValue() {
      const match = items.find((i) => i.value === value);
      valueEl.textContent = match ? match.label : (opts.placeholder || "");
      valueEl.classList.toggle("m3-custom-select__value--placeholder", !match);
    }

    function renderMenu() {
      menu.innerHTML = items.length
        ? items
            .map((item) => {
              const active = item.value === value;
              return `
                <button type="button" class="m3-custom-select__option${active ? " m3-custom-select__option--active" : ""}" data-value="${escapeHtml(item.value)}" role="option" aria-selected="${active}">
                  <span>${escapeHtml(item.label)}</span>
                  ${active ? '<svg class="m3-icon" style="width:16px;height:16px;flex-shrink:0"><use href="#icon-check"></use></svg>' : ""}
                </button>
              `;
            })
            .join("")
        : `<p class="m3-custom-select__empty">Keine Optionen verfügbar</p>`;
    }

    function positionMenu() {
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 24;
      const spaceAbove = rect.top - 24;

      menu.style.position = "fixed";
      menu.style.left = `${rect.left}px`;
      menu.style.width = `${rect.width}px`;

      if (spaceBelow < 160 && spaceAbove > spaceBelow) {
        // Nach oben öffnen
        const maxHeight = Math.max(120, spaceAbove);
        menu.style.maxHeight = `${maxHeight}px`;
        menu.style.top = "auto";
        menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      } else {
        // Nach unten öffnen
        const maxHeight = Math.max(120, spaceBelow);
        menu.style.maxHeight = `${maxHeight}px`;
        menu.style.bottom = "auto";
        menu.style.top = `${rect.bottom + 4}px`;
      }
    }

    function close() {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      if (openClose === close) openClose = null;
    }

    function onOutsidePointer(event) {
      if (!container.contains(event.target) && !menu.contains(event.target)) close();
    }

    function open() {
      if (disabled || !items.length) return;
      closeOpen();
      renderMenu();
      menu.hidden = false;
      positionMenu();
      trigger.setAttribute("aria-expanded", "true");
      openClose = close;
      document.addEventListener("pointerdown", onOutsidePointer, true);
      window.addEventListener("resize", positionMenu);
      window.addEventListener("scroll", positionMenu, true);
    }

    trigger.addEventListener("click", () => {
      if (menu.hidden) open(); else close();
    });

    menu.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-value]");
      if (!btn) return;
      value = btn.dataset.value;
      renderValue();
      close();
      if (opts.onChange) opts.onChange(value);
    });

    function setOptions(newItems, newValue) {
      items = newItems || [];
      if (newValue !== undefined) {
        value = newValue;
      } else if (!items.some((i) => i.value === value)) {
        value = items.length ? items[0].value : "";
      }
      renderValue();
      if (!menu.hidden) renderMenu();
    }

    function setValue(v) {
      value = v;
      renderValue();
      if (!menu.hidden) renderMenu();
    }

    function setDisabled(v) {
      disabled = v;
      trigger.disabled = v;
    }

    function destroy() {
      close();
      menu.remove();
    }

    setOptions(opts.options || [], opts.value);

    return { getValue: () => value, setValue, setOptions, setDisabled, close, destroy };
  }

  root.CustomSelect = { create, closeAll: closeOpen };
})(window);
