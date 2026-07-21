/**
 * Reflextest – Feld ist rot, nach einer zufälligen Wartezeit wird es grün.
 * Wer zu früh tippt, hat verloren und muss neu starten; wer nach Grün
 * antippt, sieht seine Reaktionszeit in Millisekunden. Registriert sich
 * als Untergame im Reaktionsspiele-Hub (siehe reaktion.js für die Plugin-
 * Schnittstelle).
 */
(function () {
  const MIN_DELAY_MS = 1200;
  const MAX_DELAY_MS = 4200;

  function mount(container) {
    let state = "idle"; // idle | waiting | go | result | too-early
    let waitTimeoutId = null;
    let goAt = 0;
    let bestMs = null;

    container.innerHTML = `
      <p class="reaktion-scoreline" id="rx-best">Bestzeit: –</p>
      <div class="rx-stage" id="rx-stage" data-state="idle">
        <p class="rx-stage__text" id="rx-text">Auf "Start" tippen, dann warten, bis das Feld grün wird.</p>
      </div>
      <button type="button" class="m3-button m3-button--filled" id="rx-action" style="width: 100%; margin-top: 20px">
        Start
      </button>
    `;

    const stage = container.querySelector("#rx-stage");
    const textEl = container.querySelector("#rx-text");
    const bestEl = container.querySelector("#rx-best");
    const actionBtn = container.querySelector("#rx-action");

    function setState(next) {
      state = next;
      stage.dataset.state = next;
    }

    function startRound() {
      clearTimeout(waitTimeoutId);
      setState("waiting");
      textEl.textContent = "Warte auf Grün…";
      actionBtn.hidden = true;

      const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
      waitTimeoutId = setTimeout(() => {
        setState("go");
        textEl.textContent = "JETZT TIPPEN!";
        goAt = performance.now();
        Sound.beep(880, 0.08);
      }, delay);
    }

    function handleStageClick() {
      if (state === "idle" || state === "result" || state === "too-early") return;

      if (state === "waiting") {
        clearTimeout(waitTimeoutId);
        setState("too-early");
        textEl.textContent = "Zu früh! ⚡ Nochmal versuchen";
        actionBtn.textContent = "Nochmal";
        actionBtn.hidden = false;
        Sound.beep(200, 0.15);
        return;
      }

      // state === "go"
      const elapsed = Math.round(performance.now() - goAt);
      setState("result");
      textEl.textContent = `${elapsed} ms`;
      if (bestMs === null || elapsed < bestMs) {
        bestMs = elapsed;
        bestEl.textContent = `Bestzeit: ${bestMs} ms 🏆`;
      }
      actionBtn.textContent = "Nochmal";
      actionBtn.hidden = false;
      Sound.success();
      if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(20);
    }

    stage.addEventListener("click", handleStageClick);
    actionBtn.addEventListener("click", startRound);

    return {
      teardown() {
        clearTimeout(waitTimeoutId);
        stage.removeEventListener("click", handleStageClick);
        actionBtn.removeEventListener("click", startRound);
      },
    };
  }

  window.ReaktionGames = window.ReaktionGames || [];
  window.ReaktionGames.push({
    id: "reflex",
    name: "Reflextest",
    icon: "flash",
    color: "red",
    description: "Tippe, sobald das Feld grün wird – so schnell wie möglich.",
    players: "1+ Spieler",
    mount,
  });
})();
