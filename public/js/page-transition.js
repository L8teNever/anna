/**
 * Manuelles Ausblenden vor JS-ausgelösten Seitenwechseln (z.B. "Zurück zur
 * Startseite"-Buttons) - im Gegensatz zu echten <a>-Klicks lösen diese
 * keinen Cross-Document View Transition aus, weil der Browser dafür einen
 * "richtigen" Link-Klick/Formular-Submit erwartet. Reiner Fallback: läuft
 * in jedem Browser gleich, kein Feature-Detection nötig.
 */
(function (root) {
  function navigate(url) {
    document.body.classList.add("page-transition-out");
    setTimeout(() => {
      window.location.href = url;
    }, 140);
  }

  root.PageTransition = { navigate };
})(window);
