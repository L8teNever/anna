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

    // Welche Roster-Namen sind gerade angehakt (spielen mit)? Bewusst EIN
    // gemeinsamer Zustand über alle Spiele hinweg (nicht pro Spiel), damit
    // man beim Wechsel zwischen Spielen nicht jedes Mal neu anhaken muss.
    // Wird gegen das aktuelle Roster gefiltert, damit gelöschte Namen
    // nirgends mehr auftauchen.
    getSelectedPlayers() {
      const roster = this.getRoster();
      const selected = read("selected", []);
      return selected.filter((name) => roster.includes(name));
    },
    setSelectedPlayers(names) {
      write("selected", names);
    },

    // Als Favorit markierte Spiele (Startseiten-Filter "Nur Favoriten").
    getFavorites() {
      return read("favorites", []);
    },
    toggleFavorite(gameId) {
      const favorites = this.getFavorites();
      const index = favorites.indexOf(gameId);
      if (index === -1) favorites.push(gameId);
      else favorites.splice(index, 1);
      write("favorites", favorites);
      return favorites;
    },
  };

  root.Storage = Storage;
})(window);
