/**
 * Zeitgefühl – ein Timer läuft ab dem Start unsichtbar mit, wer am
 * nächsten an genau 10 Sekunden stoppt, gewinnt. Die laufende Zeit wird
 * bewusst NICHT angezeigt (nur ein Puls-Symbol), sonst wäre es kein
 * Zeitgefühl-Test, sondern reines Ablesen. Registriert sich als Untergame
 * im Reaktionsspiele-Hub (siehe reaktion.js für die Plugin-Schnittstelle).
 */
(function () {
  const TARGET_MS = 10000;
  const CLOSE_THRESHOLD_MS = 300;

  function mount(container) {
    let running = false;
    let startedAt = 0;
    let bestDiffMs = null;

    container.innerHTML = `
      <p class="reaktion-scoreline" id="su-best">Beste Abweichung: –</p>
      <div class="su-stage" id="su-stage">
        <svg class="m3-icon su-stage__icon" id="su-icon"><use href="#icon-stopwatch"></use></svg>
        <p class="su-stage__text" id="su-text">Stoppe so nah wie möglich an genau 10 Sekunden!</p>
      </div>
      <button type="button" class="m3-button m3-button--filled" id="su-action" style="width: 100%; margin-top: 20px">
        Start
      </button>
    `;

    const stage = container.querySelector("#su-stage");
    const textEl = container.querySelector("#su-text");
    const bestEl = container.querySelector("#su-best");
    const actionBtn = container.querySelector("#su-action");

    function start() {
      running = true;
      startedAt = performance.now();
      stage.classList.remove("su-stage--close");
      stage.classList.add("su-stage--running");
      textEl.textContent = "Läuft … wann sind 10 Sekunden um?";
      actionBtn.textContent = "Stopp!";
      Sound.tick(500);
    }

    function stop() {
      if (!running) return;
      running = false;
      const elapsedMs = performance.now() - startedAt;
      const diffMs = elapsedMs - TARGET_MS;
      const diffAbsMs = Math.abs(diffMs);
      const sign = diffMs >= 0 ? "+" : "−";

      stage.classList.remove("su-stage--running");
      textEl.textContent = `${(elapsedMs / 1000).toFixed(2)}s (${sign}${(diffAbsMs / 1000).toFixed(2)}s)`;
      stage.classList.toggle("su-stage--close", diffAbsMs <= CLOSE_THRESHOLD_MS);

      if (bestDiffMs === null || diffAbsMs < bestDiffMs) {
        bestDiffMs = diffAbsMs;
        bestEl.textContent = `Beste Abweichung: ${(bestDiffMs / 1000).toFixed(2)}s 🏆`;
      }

      actionBtn.textContent = "Nochmal";
      Sound.success();
      if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(20);
    }

    function handleAction() {
      if (running) stop();
      else start();
    }

    actionBtn.addEventListener("click", handleAction);

    return {
      teardown() {
        running = false;
        actionBtn.removeEventListener("click", handleAction);
      },
    };
  }

  window.ReaktionGames = window.ReaktionGames || [];
  window.ReaktionGames.push({
    id: "stopuhr",
    name: "Zeitgefühl",
    icon: "target",
    color: "teal",
    description: "Stoppe so nah wie möglich an genau 10 Sekunden.",
    players: "1+ Spieler",
    mount,
  });
})();
