/**
 * Kleiner localStorage-Wrapper, den alle Seiten/Spiele gemeinsam nutzen.
 * Rein clientseitig – es gibt keinen Server-Zustand.
 */
(function (root) {
  const PREFIX = "anna:";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      /* Speicher voll oder deaktiviert – Spiel funktioniert trotzdem weiter. */
    }
  }

  const DEFAULT_SETTINGS = {
    theme: "system", // "light" | "dark" | "system"
    soundEnabled: true,
    vibrationEnabled: true,
  };

  const Storage = {
    getSettings() {
      return Object.assign({}, DEFAULT_SETTINGS, read("settings", {}));
    },
    setSettings(partial) {
      const merged = Object.assign(this.getSettings(), partial);
      write("settings", merged);
      return merged;
    },
    // Globale Spieler-Liste (Roster) – über alle Spiele hinweg geteilt.
    // Bleibt dauerhaft gespeichert, bis ein Name umbenannt oder gelöscht wird.
    getRoster() {
      return read("roster", []);
    },
    setRoster(names) {
      write("roster", names);
    },

    // Welche Roster-Namen sind für ein bestimmtes Spiel angehakt (spielen
    // mit)? Wird gegen das aktuelle Roster gefiltert, damit gelöschte
    // Namen nirgends mehr auftauchen.
    getSelectedPlayers(gameId) {
      const roster = this.getRoster();
      const selected = read(`selected:${gameId}`, []);
      return selected.filter((name) => roster.includes(name));
    },
    setSelectedPlayers(gameId, names) {
      write(`selected:${gameId}`, names);
    },
  };

  root.Storage = Storage;
})(window);
