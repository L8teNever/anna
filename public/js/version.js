/**
 * Zentrale Versionsnummer der App – einzige Stelle, die hochgezählt werden
 * muss, sobald sich Design/Spiele/Code/Daten ändern. Wird von sw.js für
 * den Cache-Namen genutzt UND in den Einstellungen angezeigt, damit man
 * jederzeit nachschauen kann, ob ein Gerät wirklich die neueste Version
 * geladen hat (z.B. nach einem Update-Problem). Klassisches Script (kein
 * Modul), damit es sowohl im Fenster-Kontext als auch im Service-Worker-
 * Kontext per importScripts() funktioniert – siehe game-registry.js für
 * dasselbe Muster.
 */
(function (root) {
  root.APP_VERSION = "3.6.0";
})(typeof self !== "undefined" ? self : this);
