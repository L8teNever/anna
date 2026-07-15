/**
 * Logik der Einstellungsseite. Liest/schreibt über storage.js und wendet
 * das Theme sofort auf <html data-theme> an (system.css reagiert darauf).
 */
(function () {
  const backButton = document.getElementById("back-button");
  const themeSegmented = document.getElementById("theme-segmented");
  const soundToggle = document.getElementById("sound-toggle");
  const vibrationToggle = document.getElementById("vibration-toggle");
  const updateCheckButton = document.getElementById("update-check-button");
  const clearCacheButton = document.getElementById("clear-cache-button");

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function syncThemeButtons(theme) {
    themeSegmented.querySelectorAll(".m3-segmented__option").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === theme));
    });
  }

  const settings = Storage.getSettings();
  syncThemeButtons(settings.theme);
  soundToggle.checked = settings.soundEnabled;
  vibrationToggle.checked = settings.vibrationEnabled;

  backButton.addEventListener("click", () => {
    window.location.href = "/";
  });

  themeSegmented.addEventListener("click", (event) => {
    const button = event.target.closest(".m3-segmented__option");
    if (!button) return;
    const theme = button.dataset.value;
    Storage.setSettings({ theme });
    applyTheme(theme);
    syncThemeButtons(theme);
  });

  soundToggle.addEventListener("change", () => {
    Storage.setSettings({ soundEnabled: soundToggle.checked });
  });

  vibrationToggle.addEventListener("change", () => {
    Storage.setSettings({ vibrationEnabled: vibrationToggle.checked });
  });

  updateCheckButton.addEventListener("click", async () => {
    updateCheckButton.disabled = true;
    updateCheckButton.textContent = "Suche…";
    const result = await CacheTools.checkForUpdate();
    updateCheckButton.disabled = false;
    updateCheckButton.textContent = "Prüfen";

    if (!result.supported) {
      Toast.show("Updates werden hier nicht unterstützt", "alert-triangle");
    } else if (result.updateFound) {
      Toast.show("Update gefunden – Banner erscheint gleich", "check");
    } else {
      Toast.show("Du hast bereits die neueste Version", "check");
    }
  });

  clearCacheButton.addEventListener("click", async () => {
    clearCacheButton.disabled = true;
    clearCacheButton.textContent = "Wird geleert…";
    try {
      await CacheTools.clearAll();
      Toast.show("Cache geleert – lädt neu…", "check");
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      clearCacheButton.disabled = false;
      clearCacheButton.textContent = "Cache löschen";
      Toast.show("Cache konnte nicht geleert werden", "alert-triangle");
    }
  });
})();
