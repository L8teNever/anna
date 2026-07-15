/**
 * Gemeinsamer Übergangs-Helfer zwischen "Ansichten" (App-Views) innerhalb
 * einer Seite – z.B. Startseite -> Spiel-Setup, Setup -> Mitspieler-Auswahl.
 * Jede View ist ein Element mit Klasse "app-view"; Sichtbarkeit läuft über
 * [hidden] plus einen kurzen Fade/Slide.
 */
(function (root) {
  function transition(fromEl, toEl) {
    if (!fromEl || !toEl || fromEl === toEl) return;

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
