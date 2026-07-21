/**
 * Reflextest – der GANZE Bildschirm (nicht nur eine Karte) ist rot, nach
 * einer zufälligen Wartezeit wird alles grün. Wer zu früh tippt, hat
 * verloren und muss neu starten; wer nach Grün antippt, sieht seine
 * Reaktionszeit in Millisekunden. Registriert sich als Untergame im
 * Reaktionsspiele-Hub (siehe reaktion.js für die Plugin-Schnittstelle).
 */
(function () {
  const MIN_DELAY_MS = 1200;
  const MAX_DELAY_MS = 4200;

  function mount(container) {
    let state = "idle"; // idle | waiting | go | result | too-early
    let waitTimeoutId = null;
    let goAt = 0;
    let bestMs = null;

    // Bricht bewusst aus der normalen, eingerahmten Untergame-Karte aus
    // (siehe .reaktion-subgame-stage--full in reaktion.css) - der ganze
    // Bildschirm unterhalb der Kopfzeile soll die Farbe wechseln, nicht
    // nur eine Karte darin.
    container.classList.add("reaktion-subgame-stage--full");
    container.innerHTML = `
      <div class="rx-fullstage" id="rx-fullstage" data-state="idle">
        <p class="rx-fullstage__best" id="rx-best">Bestzeit: –</p>
        <p class="rx-fullstage__text" id="rx-text">Auf "Start" tippen, dann warten, bis der ganze Bildschirm grün wird.</p>
        <button type="button" class="m3-button m3-button--filled" id="rx-action">Start</button>
      </div>
    `;

    const fullstage = container.querySelector("#rx-fullstage");
    const textEl = container.querySelector("#rx-text");
    const bestEl = container.querySelector("#rx-best");
    const actionBtn = container.querySelector("#rx-action");

    function setState(next) {
      state = next;
      fullstage.dataset.state = next;
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

    function handleActionClick(event) {
      // Der Start/Nochmal-Button liegt INNERHALB der klickbaren Vollbild-
      // Fläche - ohne stopPropagation würde derselbe Klick zusätzlich
      // handleStageClick auslösen (Event-Bubbling).
      event.stopPropagation();
      startRound();
    }

    fullstage.addEventListener("click", handleStageClick);
    actionBtn.addEventListener("click", handleActionClick);

    return {
      teardown() {
        clearTimeout(waitTimeoutId);
        fullstage.removeEventListener("click", handleStageClick);
        actionBtn.removeEventListener("click", handleActionClick);
        container.classList.remove("reaktion-subgame-stage--full");
      },
    };
  }

  window.ReaktionGames = window.ReaktionGames || [];
  window.ReaktionGames.push({
    id: "reflex",
    name: "Reflextest",
    icon: "flash",
    color: "red",
    description: "Tippe, sobald der Bildschirm grün wird – so schnell wie möglich.",
    players: "1+ Spieler",
    mount,
  });
})();
