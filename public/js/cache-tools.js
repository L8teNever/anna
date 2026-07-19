/**
 * Gemeinsame Logik für "Nach Updates suchen" und "Cache löschen", genutzt
 * vom Einstellungen-Modal (index.html) und der eigenständigen
 * Einstellungsseite (settings/index.html).
 *
 * checkForUpdate() behauptet NIE pauschal "kein Update gefunden" – es
 * meldet den tatsächlichen Zustand nach dem Update-Check zurück.
 * clearAll() löscht wirklich ALLES: sämtliche Cache-Storage-Einträge, den/
 * die registrierten Service Worker UND localStorage/sessionStorage (Spieler-
 * liste, Favoriten, Einstellungen, Theme, "Datenschutz-Hinweis gesehen" ...).
 * Danach ist das Gerät in genau dem Zustand wie beim allerersten Besuch –
 * das ist der ganze Sinn des Buttons, nicht nur ein Update-Fix.
 */
(function (root) {
  async function clearAll() {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    localStorage.clear();
    sessionStorage.clear();
  }

  async function checkForUpdate() {
    if (!("serviceWorker" in navigator)) return { supported: false };

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return { supported: true, registered: false, updateFound: false };

    await registration.update();
    // Kurz warten, damit ein evtl. neu gefundener Worker Zeit hat, in den
    // "installing"/"waiting" Zustand zu wechseln, bevor wir das Ergebnis lesen.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      supported: true,
      registered: true,
      updateFound: Boolean(registration.waiting || registration.installing),
    };
  }

  root.CacheTools = { clearAll, checkForUpdate };
})(window);
