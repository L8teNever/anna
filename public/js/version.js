/**
 * Versionsnummer für normale Seiten (window.APP_VERSION) – wird in den
 * Einstellungen angezeigt, damit man nachschauen kann, ob ein Gerät
 * wirklich die neueste Version geladen hat, und von pwa-helper.js für den
 * netzwerkbasierten Versions-Mismatch-Check abgefragt.
 *
 * WICHTIG: `sw.js` hat seine EIGENE, literale Kopie dieser Zahl direkt in
 * der Datei (nicht per importScripts() von hier) – nur so erkennt der
 * Browser Updates zuverlässig (siehe ausführlicher Kommentar dort). Beide
 * Stellen bei jeder Änderung gemeinsam hochzählen!
 */
(function (root) {
  root.APP_VERSION = "3.53.0";
})(typeof self !== "undefined" ? self : this);
