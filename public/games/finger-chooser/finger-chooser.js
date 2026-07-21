/**
 * Finger-Chooser – jede Person legt einen Finger auf den Bildschirm, jeder
 * Finger bekommt sofort eine eigene Farbe. Nach kurzem gemeinsamem Halten
 * füllt sich ein Ladering um jeden Finger; ist er voll, wird sofort
 * ausgewählt. Über die Einstellungen (oben rechts) lässt sich der Modus
 * wechseln: Gewinner oder Teams, jeweils mit einstellbarer Anzahl.
 *
 * Sobald nach der Auswahl alle Finger vom Bildschirm genommen wurden,
 * setzt sich der Chooser nach AUTO_RESET_DELAY_MS von selbst zurück - kein
 * manueller "Nochmal"-Button nötig.
 */
(function () {
  const MIN_FINGERS = 2;
  const HOLD_MS = 1400; // MUSS zur animation-duration von .fc-dot__ring-fill in finger-chooser.css passen
  const COUNT_BOUNDS = {
    winners: { min: 1, max: 6 },
    teams: { min: 2, max: 6 },
  };
  // Bis zu 6 Teams unterscheidbar (siehe .fc-dot--team-a .. --team-f in
  // finger-chooser.css) - reicht für praktisch jede realistische Fingerzahl.
  const TEAM_CLASSES = ["fc-dot--team-a", "fc-dot--team-b", "fc-dot--team-c", "fc-dot--team-d", "fc-dot--team-e", "fc-dot--team-f"];

  // Solide Randfarbe + passende halbtransparente Füllung pro Finger, nach
  // Reihenfolge des Auftippens vergeben (siehe nextColorIndex unten).
  const DOT_COLORS = [
    { solid: "#42a5f5", fill: "rgba(66, 165, 245, 0.28)" },
    { solid: "#ef5350", fill: "rgba(239, 83, 80, 0.28)" },
    { solid: "#66bb6a", fill: "rgba(102, 187, 106, 0.28)" },
    { solid: "#ffca28", fill: "rgba(255, 202, 40, 0.28)" },
    { solid: "#ab47bc", fill: "rgba(171, 71, 188, 0.28)" },
    { solid: "#26c6da", fill: "rgba(38, 198, 218, 0.28)" },
    { solid: "#ff7043", fill: "rgba(255, 112, 67, 0.28)" },
    { solid: "#8d6e63", fill: "rgba(141, 110, 99, 0.28)" },
    { solid: "#ec407a", fill: "rgba(236, 64, 122, 0.28)" },
    { solid: "#78909c", fill: "rgba(120, 144, 156, 0.28)" },
  ];

  // Nach der Auswahl wartet der Chooser, bis WIRKLICH alle Finger vom
  // Bildschirm genommen wurden, und setzt dann von selbst zurück - kein
  // manueller "Nochmal"-Button mehr nötig.
  const AUTO_RESET_DELAY_MS = 3000;

  const backButton = document.getElementById("back-button");
  const statusEl = document.getElementById("fc-status");
  const surface = document.getElementById("fc-surface");
  const settingsButton = document.getElementById("fc-settings-button");
  const settingsModal = document.getElementById("fc-settings-modal");
  const modeSegmented = document.getElementById("fc-mode-segmented");
  const countLabelEl = document.getElementById("fc-count-label");
  const countValueEl = document.getElementById("fc-count-value");
  const countMinusBtn = document.getElementById("fc-count-minus");
  const countPlusBtn = document.getElementById("fc-count-plus");

  const activeTouches = new Map(); // identifier -> { el }
  let nextColorIndex = 0;
  let holdTimeoutId = null;
  let autoResetTimeoutId = null;
  let selecting = false;
  let selected = false;
  let currentMode = "winners"; // winners | teams
  let winnerCount = 1;
  let teamCount = 2;

  function createDot(x, y) {
    const color = DOT_COLORS[nextColorIndex % DOT_COLORS.length];
    nextColorIndex += 1;

    const dot = document.createElement("div");
    dot.className = "fc-dot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.setProperty("--dot-color", color.solid);
    dot.style.setProperty("--dot-fill", color.fill);
    dot.innerHTML = `
      <svg class="fc-dot__ring" viewBox="0 0 100 100">
        <circle class="fc-dot__ring-bg" cx="50" cy="50" r="42"></circle>
        <circle class="fc-dot__ring-fill" cx="50" cy="50" r="42"></circle>
      </svg>
    `;
    surface.appendChild(dot);
    return dot;
  }

  function updateStatus() {
    if (selected || selecting) return;
    const count = activeTouches.size;
    if (count === 0) {
      statusEl.textContent = "Alle Finger gleichzeitig auf den Bildschirm legen…";
    } else if (count < MIN_FINGERS) {
      statusEl.textContent = `${count} Finger erkannt – mindestens ${MIN_FINGERS} nötig`;
    } else {
      statusEl.textContent = `${count} Finger erkannt – ruhig halten…`;
    }
  }

  function clearHoldTimer() {
    if (holdTimeoutId) {
      clearTimeout(holdTimeoutId);
      holdTimeoutId = null;
    }
  }

  function clearAutoResetTimer() {
    if (autoResetTimeoutId) {
      clearTimeout(autoResetTimeoutId);
      autoResetTimeoutId = null;
    }
  }

  function scheduleAutoReset() {
    clearAutoResetTimer();
    // Punkte schrumpfen sichtbar über genau AUTO_RESET_DELAY_MS auf
    // Größe 0 - die Übergangsdauer kommt hier direkt aus derselben
    // Konstante wie der Reset-Timer selbst, damit beides exakt zusammen
    // fertig wird (kein zweiter, separat gepflegter Zeitwert im CSS).
    surface.querySelectorAll(".fc-dot").forEach((dot) => {
      dot.style.transition = `transform ${AUTO_RESET_DELAY_MS}ms linear, opacity ${AUTO_RESET_DELAY_MS}ms linear`;
      dot.classList.add("fc-dot--vanishing");
    });
    autoResetTimeoutId = setTimeout(reset, AUTO_RESET_DELAY_MS);
  }

  // Startet/stoppt den Lade-Ring auf ALLEN aktuell liegenden Fingern
  // gleichzeitig - läuft exakt HOLD_MS lang (siehe CSS), damit alle Ringe
  // im selben Moment fertig sind, in dem finishSelection() feuert.
  function setCharging(isCharging) {
    activeTouches.forEach((entry) => {
      if (isCharging) {
        // Reflow erzwingen, damit die CSS-Animation bei jedem (Neu-)Start
        // zuverlässig von vorne beginnt.
        entry.el.classList.remove("fc-dot--charging");
        void entry.el.offsetWidth;
        entry.el.classList.add("fc-dot--charging");
      } else {
        entry.el.classList.remove("fc-dot--charging");
      }
    });
  }

  function scheduleSelection() {
    clearHoldTimer();
    if (activeTouches.size >= MIN_FINGERS && !selecting && !selected) {
      setCharging(true);
      holdTimeoutId = setTimeout(finishSelection, HOLD_MS);
    } else {
      setCharging(false);
    }
  }

  function finishSelection() {
    if (activeTouches.size < MIN_FINGERS) return;
    selecting = false;
    selected = true;
    clearHoldTimer();

    const dots = Array.from(activeTouches.values()).map((entry) => entry.el);
    const shuffledIdx = dots.map((_, i) => i).sort(() => Math.random() - 0.5);

    if (currentMode === "teams") {
      // Nie mehr Teams als Finger vorhanden sind - sonst blieben Teams leer.
      const teams = Math.max(2, Math.min(teamCount, dots.length));
      dots.forEach((el) => el.classList.remove("fc-dot--charging"));
      shuffledIdx.forEach((dotIdx, order) => {
        dots[dotIdx].classList.add(TEAM_CLASSES[order % teams]);
      });
      statusEl.textContent = `In ${teams} Teams aufgeteilt! 🎉`;
    } else {
      const winners = Math.max(1, Math.min(winnerCount, dots.length));
      const winnerSet = new Set(shuffledIdx.slice(0, winners));
      dots.forEach((el, i) => {
        el.classList.remove("fc-dot--charging");
        el.classList.toggle("fc-dot--winner", winnerSet.has(i));
        el.classList.toggle("fc-dot--loser", !winnerSet.has(i));
      });
      statusEl.textContent = winners > 1 ? "Diese Personen sind dran! 🎉" : "Diese Person ist dran! 🎉";
    }

    Sound.success();
    if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate([40, 40, 120]);

    // Fingerabdrücke bleiben sichtbar, bis die zugehörigen Finger
    // tatsächlich abgehoben werden (siehe onTouchEnd) - erst wenn ALLE weg
    // sind, startet der Auto-Reset-Countdown.
    if (activeTouches.size === 0) scheduleAutoReset();
  }

  function reset() {
    clearHoldTimer();
    clearAutoResetTimer();
    surface.innerHTML = "";
    activeTouches.clear();
    nextColorIndex = 0;
    selecting = false;
    selected = false;
    updateStatus();
  }

  function onTouchStart(event) {
    event.preventDefault();
    if (selected || selecting) return;
    const rect = surface.getBoundingClientRect();
    Array.from(event.changedTouches).forEach((touch) => {
      if (activeTouches.has(touch.identifier)) return;
      const el = createDot(touch.clientX - rect.left, touch.clientY - rect.top);
      activeTouches.set(touch.identifier, { el });
    });
    updateStatus();
    scheduleSelection();
  }

  function onTouchMove(event) {
    event.preventDefault();
    if (selected || selecting) return;
    const rect = surface.getBoundingClientRect();
    Array.from(event.changedTouches).forEach((touch) => {
      const entry = activeTouches.get(touch.identifier);
      if (!entry) return;
      entry.el.style.left = `${touch.clientX - rect.left}px`;
      entry.el.style.top = `${touch.clientY - rect.top}px`;
    });
  }

  function onTouchEnd(event) {
    event.preventDefault();
    if (selecting) return; // mitten im (kurzen) Auswahl-Moment nichts anfassen

    if (selected) {
      // Ergebnis bleibt sichtbar (Sieger/Team-Farbe), auch wenn der Finger
      // schon abgehoben wurde - nur aus der Tracking-Map nehmen, damit wir
      // wissen, wann WIRKLICH alle weg sind.
      Array.from(event.changedTouches).forEach((touch) => {
        activeTouches.delete(touch.identifier);
      });
      if (activeTouches.size === 0) scheduleAutoReset();
      return;
    }

    Array.from(event.changedTouches).forEach((touch) => {
      const entry = activeTouches.get(touch.identifier);
      if (!entry) return;
      entry.el.remove();
      activeTouches.delete(touch.identifier);
    });
    updateStatus();
    scheduleSelection();
  }

  surface.addEventListener("touchstart", onTouchStart, { passive: false });
  surface.addEventListener("touchmove", onTouchMove, { passive: false });
  surface.addEventListener("touchend", onTouchEnd, { passive: false });
  surface.addEventListener("touchcancel", onTouchEnd, { passive: false });

  /* ------------------------------------------------------------------ */
  /* Einstellungen: Auswahl-Modus + einstellbare Anzahl                   */
  /* ------------------------------------------------------------------ */
  function syncModeButtons() {
    modeSegmented.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === currentMode));
    });
  }

  function currentCount() {
    return currentMode === "teams" ? teamCount : winnerCount;
  }

  function syncCountUI() {
    const bounds = COUNT_BOUNDS[currentMode];
    const count = currentCount();
    countValueEl.textContent = String(count);
    countLabelEl.textContent = currentMode === "teams" ? "Anzahl Teams" : "Anzahl Gewinner";
    countMinusBtn.disabled = count <= bounds.min;
    countPlusBtn.disabled = count >= bounds.max;
  }

  function setCount(next) {
    const bounds = COUNT_BOUNDS[currentMode];
    const clamped = Math.max(bounds.min, Math.min(bounds.max, next));
    if (currentMode === "teams") teamCount = clamped;
    else winnerCount = clamped;
    syncCountUI();
  }

  modeSegmented.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-mode]");
    if (!btn) return;
    currentMode = btn.dataset.mode;
    syncModeButtons();
    syncCountUI();
  });

  countMinusBtn.addEventListener("click", () => setCount(currentCount() - 1));
  countPlusBtn.addEventListener("click", () => setCount(currentCount() + 1));

  function closeSettingsModal() {
    settingsModal.hidden = true;
  }

  settingsButton.addEventListener("click", () => {
    settingsModal.hidden = false;
  });
  settingsModal.querySelector("[data-fc-settings-close]").addEventListener("click", closeSettingsModal);
  settingsModal.querySelector("[data-fc-settings-backdrop]").addEventListener("click", closeSettingsModal);

  backButton.addEventListener("click", () => {
    PageTransition.navigate("/");
  });

  // Kein Zwischenstand, der beim Verlassen "verloren" gehen könnte.
  window.confirmGameExit = function () {
    return true;
  };

  syncModeButtons();
  syncCountUI();
  updateStatus();

  function teardown() {
    clearHoldTimer();
    clearAutoResetTimer();
  }
  window.addEventListener("beforeunload", teardown, { signal: Router.signal });
  Router.onTeardown(teardown);
})();
