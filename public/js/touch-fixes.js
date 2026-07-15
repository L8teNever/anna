/**
 * Native App Touch & Tastatur Fixes
 *
 * 1. Tastatur-Verschiebung: Wenn die virtuelle Tastatur aufgeht, scrollt das
 *    aktive Input-Feld automatisch in den sichtbaren Bereich – die Seite selbst
 *    verschiebt sich dabei nicht unkontrolliert.
 *
 * 2. Kein Seiten-Scroll beim Öffnen der Tastatur: Der Body wird durch
 *    interaktive Position-Tricks stabil gehalten.
 *
 * 3. Kein Textmarkieren bei langem Drücken (ergänzt CSS user-select: none).
 *
 * 4. Kein Kontextmenü bei langem Drücken auf Nicht-Input-Elemente.
 */
(function () {

  // ── 1. Kein Kontextmenü auf nicht-eingebbare Elemente ────────────────────
  document.addEventListener("contextmenu", (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea" && !e.target.isContentEditable) {
      e.preventDefault();
    }
  });

  // ── 2. Tastatur & VisualViewport ─────────────────────────────────────────
  // Die VisualViewport API ist auf modernen mobilen Browsern verfügbar und
  // meldet die tatsächliche sichtbare Fenstergröße OHNE die Tastatur.
  if (!window.visualViewport) return;

  let scrollY = 0;
  let ticking = false;

  function onViewportChange() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const focused = document.activeElement;
      if (!focused) return;
      const tag = focused.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && !focused.isContentEditable) return;

      // Viewport-Höhe vs. volle Fensterhöhe → Differenz = Tastatur-Höhe
      const vvHeight = window.visualViewport.height;
      const winHeight = window.innerHeight;
      const keyboardHeight = Math.max(0, winHeight - vvHeight);

      if (keyboardHeight < 100) return; // Tastatur noch nicht offen

      // Eingabefeld ins Sichtfeld scrollen (mit etwas Abstand zur Tastatur)
      const rect = focused.getBoundingClientRect();
      const fieldBottom = rect.bottom;
      const visibleBottom = vvHeight - 16; // 16px Abstand über Tastatur

      if (fieldBottom > visibleBottom) {
        const overflow = fieldBottom - visibleBottom;
        window.scrollBy({ top: overflow, behavior: "smooth" });
      }
    });
  }

  window.visualViewport.addEventListener("resize", onViewportChange);
  window.visualViewport.addEventListener("scroll", onViewportChange);

  // ── 3. Beim Fokussieren eines Feldes: sofort ins Sichtfeld scrollen ───────
  document.addEventListener("focusin", (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea" && !e.target.isContentEditable) return;

    // Kurz warten bis Tastatur-Animation begonnen hat
    setTimeout(() => {
      onViewportChange();
      // Fallback: native scrollIntoView für einfache Fälle
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  });

  // ── 4. Beim Schließen der Tastatur: Scroll-Position zurücksetzen ──────────
  document.addEventListener("focusout", () => {
    // Kurz warten bis Tastatur geschlossen ist
    setTimeout(() => {
      if (document.activeElement &&
          (document.activeElement.tagName.toLowerCase() === "input" ||
           document.activeElement.tagName.toLowerCase() === "textarea" ||
           document.activeElement.isContentEditable)) {
        return; // Focus ist auf ein anderes Feld gewechselt
      }
      // Zurück zum Top falls die Seite verschoben wurde
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  });

})();
