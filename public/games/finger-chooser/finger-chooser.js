/**
 * Finger-Chooser – jede Person legt einen Finger auf den Bildschirm, nach
 * kurzem gemeinsamen Halten wählt die App per kleiner "Roulette"-Animation
 * zufällig eine Person aus. Kein Rollen-/Rundensystem wie die anderen
 * Spiele, bewusst ein einfaches Werkzeug für "wer ist dran".
 */
(function () {
  const MIN_FINGERS = 2;
  const HOLD_MS = 1200; // so lange müssen mindestens MIN_FINGERS ruhig liegen
  const STEP_BASE_MS = 55; // Tempo der Roulette-Animation zu Beginn
  const STEP_MAX_EXTRA_MS = 240; // zusätzliche Verzögerung zum Ende hin (wird langsamer)

  const backButton = document.getElementById("back-button");
  const statusEl = document.getElementById("fc-status");
  const surface = document.getElementById("fc-surface");
  const actions = document.getElementById("fc-actions");
  const resetButton = document.getElementById("fc-reset-button");

  const activeTouches = new Map(); // identifier -> { el }
  let holdTimeoutId = null;
  let spinTimeoutId = null;
  let selecting = false;
  let selected = false;

  function createDot(x, y) {
    const dot = document.createElement("div");
    dot.className = "fc-dot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
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

  function clearSpinTimer() {
    if (spinTimeoutId) {
      clearTimeout(spinTimeoutId);
      spinTimeoutId = null;
    }
  }

  function scheduleSelection() {
    clearHoldTimer();
    if (activeTouches.size >= MIN_FINGERS && !selecting && !selected) {
      holdTimeoutId = setTimeout(startSelection, HOLD_MS);
    }
  }

  // Der Gewinner wird VORHER zufällig bestimmt, die Roulette-Animation
  // läuft dann eine feste Anzahl voller Runden über alle Finger und landet
  // exakt auf diesem Index - fühlt sich dadurch wie ein "sich entscheidendes"
  // Rattern an, statt am Ende einen zweiten, unabhängigen Zufallswert zu
  // zeigen, der nicht zur Animation passt.
  function startSelection() {
    clearHoldTimer();
    if (activeTouches.size < MIN_FINGERS) return;

    selecting = true;
    const dots = Array.from(activeTouches.values()).map((entry) => entry.el);
    statusEl.textContent = "Wer wird's? …";

    const winnerIdx = Math.floor(Math.random() * dots.length);
    const fullRounds = 3 + Math.floor(Math.random() * 2); // 3-4 volle Runden
    const totalSteps = fullRounds * dots.length + winnerIdx + 1;

    let step = 0;
    function tick() {
      dots.forEach((el) => el.classList.remove("fc-dot--active"));
      const idx = step % dots.length;
      dots[idx].classList.add("fc-dot--active");
      Sound.tick(420 + idx * 30);
      step += 1;

      if (step < totalSteps) {
        const progress = step / totalSteps;
        const delay = STEP_BASE_MS + progress * progress * STEP_MAX_EXTRA_MS;
        spinTimeoutId = setTimeout(tick, delay);
      } else {
        finishSelection(dots, winnerIdx);
      }
    }
    tick();
  }

  function finishSelection(dots, winnerIdx) {
    dots.forEach((el, i) => {
      el.classList.remove("fc-dot--active");
      el.classList.toggle("fc-dot--winner", i === winnerIdx);
      el.classList.toggle("fc-dot--loser", i !== winnerIdx);
    });
    selecting = false;
    selected = true;
    spinTimeoutId = null;
    statusEl.textContent = "Diese Person ist dran! 🎉";
    Sound.success();
    if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate([40, 40, 120]);
    actions.hidden = false;
  }

  function reset() {
    clearHoldTimer();
    clearSpinTimer();
    activeTouches.forEach((entry) => entry.el.remove());
    activeTouches.clear();
    selecting = false;
    selected = false;
    actions.hidden = true;
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
    if (selected || selecting) return;
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

  resetButton.addEventListener("click", reset);

  backButton.addEventListener("click", () => {
    PageTransition.navigate("/");
  });

  // Kein Zwischenstand, der beim Verlassen verloren gehen könnte.
  window.confirmGameExit = function () {
    return true;
  };

  updateStatus();

  function teardown() {
    clearHoldTimer();
    clearSpinTimer();
  }
  window.addEventListener("beforeunload", teardown, { signal: Router.signal });
  Router.onTeardown(teardown);
})();
