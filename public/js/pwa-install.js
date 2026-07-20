/**
 * Erfasst das native "beforeinstallprompt"-Event zentral und stellt es
 * app-weit über window.PwaInstall zur Verfügung (pwa-install-banner.js auf
 * der Startseite, settings.js auf der Einstellungsseite).
 *
 * WICHTIG - nur Chrome/Edge/Chromium-Browser (Android + Desktop) feuern
 * dieses Event überhaupt. Safari (iOS und macOS) und Firefox tun das NIE -
 * dort bleibt isAvailable() für immer false und es gibt bewusst KEINEN
 * Ersatz-Hinweis ("Manuell zum Home-Bildschirm hinzufügen" o.ä.), weil genau
 * das nicht gewünscht ist: kein Installations-Hinweis, wenn er nicht zu
 * einem echten Installieren-Button führen kann.
 *
 * Lädt wie pwa-helper.js als Head-Script auf JEDER Seite (nicht nur der
 * Startseite) - beforeinstallprompt kann grundsätzlich bei jedem Seiten-
 * aufruf feuern, nicht nur beim allerersten, und die Einstellungsseite
 * braucht den Zustand unabhängig davon, ob man vorher auf der Startseite
 * war (z.B. bei einem direkten Lesezeichen auf /settings).
 */
(function (root) {
  let deferredPrompt = null;
  let installedThisSession = false;
  const listeners = [];

  function notify() {
    listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.warn("[anna] PwaInstall-Listener-Fehler:", err);
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
    deferredPrompt = null;
    notify();
  });

  function isInstalled() {
    if (installedThisSession) return true;
    if (window.navigator.standalone === true) return true;
    if (!window.matchMedia) return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches
    );
  }

  function isAvailable() {
    return Boolean(deferredPrompt) && !isInstalled();
  }

  async function promptInstall() {
    if (!deferredPrompt) return null;
    const promptEvent = deferredPrompt;
    deferredPrompt = null; // jedes Event ist nur EINMAL nutzbar
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    notify();
    return choice;
  }

  function onChange(callback) {
    listeners.push(callback);
  }

  root.PwaInstall = { isAvailable, isInstalled, promptInstall, onChange };
})(window);
