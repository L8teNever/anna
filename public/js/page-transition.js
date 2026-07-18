/**
 * Kompatibilitäts-Shim: JS-ausgelöste Navigationen (z.B. "Zurück zur
 * Startseite"-Buttons) rufen weiterhin PageTransition.navigate(url) auf,
 * das jetzt einfach an den Router (router.js) durchreicht, statt selbst
 * einen Fade + window.location.href zu bauen.
 */
(function (root) {
  root.PageTransition = {
    navigate(url) {
      root.Router.navigate(url);
    },
  };
})(window);
