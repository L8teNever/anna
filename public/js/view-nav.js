/**
 * Gemeinsamer Übergangs-Helfer zwischen "Ansichten" (App-Views) innerhalb
 * einer Seite – z.B. Startseite -> Spiel-Setup, Setup -> Mitspieler-Auswahl.
 * Jede View ist ein Element mit Klasse "app-view"; Sichtbarkeit läuft über
 * [hidden] plus einen kurzen Fade/Slide.
 *
 * Vollbild-Unteransichten (Mitspieler-/Kategorie-Auswahl) haben bereits
 * ihren eigenen Header mit Zurück-Button – der äußere #game-topbar würde
 * dann als zweiter, redundanter Header direkt darüber sitzen. Views mit
 * [data-hide-topbar] blenden ihn deshalb aus, solange sie sichtbar sind.
 */
(function (root) {
  function transition(fromEl, toEl) {
    if (!fromEl || !toEl || fromEl === toEl) return;

    const topbar = document.getElementById("game-topbar");
    if (topbar) topbar.hidden = toEl.hasAttribute("data-hide-topbar");

    fromEl.classList.add("app-view--leaving");
    setTimeout(() => {
      fromEl.hidden = true;
      fromEl.classList.remove("app-view--leaving");
      toEl.hidden = false;
      toEl.classList.add("app-view--entering");
      requestAnimationFrame(() => {
        toEl.classList.remove("app-view--entering");
      });
    }, 220);
  }

  root.ViewNav = { transition };
})(window);
