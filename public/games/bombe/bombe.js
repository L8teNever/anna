/**
 * Tickende Bombe – "Heiße Kartoffel"-Variante mit Kategorien.
 *
 * Spielprinzip:
 *   Beim Rundenstart wird eine zufällige Kategorie aus den gewählten
 *   Kategorien gezogen und deutlich angezeigt. Jeder, der die Bombe
 *   hält, muss EINEN Begriff aus dieser Kategorie nennen, bevor er
 *   weiterzugibt. Wer die Bombe hält, wenn sie explodiert, hat verloren.
 */
(function () {
  const MIN_PLAYERS  = 2;
  const MAX_PLAYERS  = 8;

  // Zünddauer wird nicht mehr manuell eingegeben, sondern hängt an der
  // Mitspielerzahl: je mehr Leute im Kreis sitzen, desto länger dauert eine
  // Runde von Hand zu Hand - sonst wäre die Bombe bei 8 Leuten oft schon
  // explodiert, bevor sie überhaupt einmal rum war.
  const SECONDS_PER_PLAYER_MIN = 7;
  const SECONDS_PER_PLAYER_MAX = 20;

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                        */
  /* ------------------------------------------------------------------ */
  const setupView          = document.getElementById("setup-view");
  const categorySelectView = document.getElementById("view-category-select");
  const playerSelectView   = document.getElementById("view-player-select");
  const playView           = document.getElementById("play-view");
  const backButton         = document.getElementById("back-button");

  const fuseRangeDisplay = document.getElementById("fuse-range-display");
  const startButton      = document.getElementById("start-button");

  const bombRing        = document.getElementById("bomb-ring");
  const bombIcon        = document.getElementById("bomb-icon");
  const bombIconUse     = bombIcon.querySelector("use");
  const playStatus      = document.getElementById("play-status");
  const playActions     = document.getElementById("play-actions");
  const restartButton   = document.getElementById("restart-button");
  const exitButton      = document.getElementById("exit-button");
  const quickRatingEl   = document.getElementById("quick-rating");

  const openCategorySelectBtn = document.getElementById("open-category-select-button");
  const categoryBackButton    = document.getElementById("category-select-back-button");
  const categoryConfirmButton = document.getElementById("category-select-confirm-button");

  const playerSummary        = document.getElementById("player-select-summary");
  const openPlayerSelectBtn  = document.getElementById("open-player-select-button");
  const playerBackButton     = document.getElementById("player-select-back-button");
  const playerConfirmButton  = document.getElementById("player-select-confirm-button");

  const validationWarning     = document.getElementById("validation-warning");
  const validationWarningText = document.getElementById("validation-warning-text");

  // Aktive Kategorieanzeige im Spielfeld
  const activeCatBadge  = document.getElementById("active-cat-badge");
  const activeCatText   = document.getElementById("active-cat-text");
  const activeCatExample = document.getElementById("active-cat-example");

  // Start-Reveal ("X fängt an"), liegt kurz über dem restlichen Spielfeld
  const starterReveal     = document.getElementById("starter-reveal");
  const starterRevealName = document.getElementById("starter-reveal-name");
  const starterRevealPrompt     = document.getElementById("starter-reveal-prompt");
  const starterRevealPromptText = document.getElementById("starter-reveal-prompt-text");
  const starterRevealPromptCat  = document.getElementById("starter-reveal-prompt-cat");
  const starterRevealSkip       = document.getElementById("starter-reveal-skip");
  // Muss >= der längsten CSS-Exit-Animation sein (starter-wave-exit-up läuft
  // 1.8s, siehe bombe.css) - sonst wird das Element per hidden=true schon
  // mitten in der Bewegung abgeschnitten statt sauber auszulaufen.
  const STARTER_REVEAL_OUT_MS = 1850;

  const playerPicker = PlayerPicker.create();
  const categoryPicker = CategoryPicker.create("bombe", "/games/bombe/categories.json");
  let tickTimeoutId  = null;
  let roundActive    = false;
  let starterRevealOutTimeoutId  = null;
  let starterRevealDismissHandler = null;
  let currentRoundCategory = null; // { id, label, icon, word } - für das Runden-Ende-Feedback

  /* ------------------------------------------------------------------ */
  /* Zünddauer aus Mitspielerzahl berechnen                               */
  /* ------------------------------------------------------------------ */
  function computeFuseRange(count) {
    const players = Math.max(MIN_PLAYERS, count || MIN_PLAYERS);
    return {
      min: players * SECONDS_PER_PLAYER_MIN,
      max: players * SECONDS_PER_PLAYER_MAX,
    };
  }

  function updateFuseRangeDisplay(count) {
    const { min, max } = computeFuseRange(count);
    fuseRangeDisplay.textContent = `${min}–${max} Sek.`;
  }

  /* ------------------------------------------------------------------ */
  /* Ansichten wechseln                                                    */
  /* ------------------------------------------------------------------ */
  openCategorySelectBtn.addEventListener("click", () => ViewNav.transition(setupView, categorySelectView));
  categoryBackButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));
  categoryConfirmButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));

  function updatePlayerSummary() {
    const count = playerPicker.getActiveCount();
    playerSummary.textContent = count === 1 ? "1 Spieler ausgewählt" : `${count} Spieler ausgewählt`;
    updateValidation(count);
    updateFuseRangeDisplay(count);
  }

  function updateValidation(count) {
    const valid = count >= MIN_PLAYERS && count <= MAX_PLAYERS;
    validationWarning.hidden = valid;
    if (!valid) {
      validationWarningText.textContent = count < MIN_PLAYERS
        ? `Mindestens ${MIN_PLAYERS} Mitspieler nötig (aktuell ${count}).`
        : `Höchstens ${MAX_PLAYERS} Mitspieler möglich (aktuell ${count}).`;
    }
    startButton.disabled = !valid;
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Begriff-Verlauf (gegen Wiederholungen)                               */
  /* ------------------------------------------------------------------ */
  // Jeder gezeigte Begriff (auch geskippte) landet hinten in diesem
  // Verlauf. Liegt NUR im localStorage dieses Geräts (nie auf dem Server)
  // und überlebt damit auch Verlassen/Neustarten des Spiels oder neue
  // Mitspieler - die Begriffe der letzten Runden kommen so erst wieder,
  // wenn alle anderen aus den gewählten Kategorien schon dran waren.
  const HISTORY_KEY = "anna:bombe:history";
  const HISTORY_MAX = 1000;

  function promptKey(catId, word) {
    return `${catId}::${word || ""}`;
  }

  function readHistory() {
    try {
      const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function rememberPrompt(key) {
    const list = readHistory().filter((k) => k !== key);
    list.push(key);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-HISTORY_MAX)));
    } catch (err) {
      /* Speicher voll oder deaktiviert – Spiel läuft trotzdem weiter. */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Begriff für diese Runde ziehen                                       */
  /* ------------------------------------------------------------------ */
  // Zuerst zufällig aus den Begriffen der gewählten Kategorien, die noch
  // nie (bzw. seit dem Verlauf-Limit nicht) dran waren. Sind alle schon
  // gelaufen, zufällig aus dem ältesten Viertel - so kommt nie direkt
  // wieder, was gerade erst gespielt wurde.
  function pickCategory() {
    const active = categoryPicker.getSelectedCategories();
    if (!active.length) return null;

    const candidates = [];
    active.forEach((cat) => {
      const words = Array.isArray(cat.words) && cat.words.length ? cat.words : [null];
      words.forEach((word) => candidates.push({ cat, word, key: promptKey(cat.id, word) }));
    });

    const history = readHistory();
    const lastUsed = new Map(history.map((key, index) => [key, index]));
    const fresh = candidates.filter((c) => !lastUsed.has(c.key));

    let pool = fresh;
    if (!pool.length) {
      const byAge = candidates.slice().sort((a, b) => lastUsed.get(a.key) - lastUsed.get(b.key));
      pool = byAge.slice(0, Math.max(1, Math.ceil(byAge.length / 4)));
    }

    const choice = pool[Math.floor(Math.random() * pool.length)];
    rememberPrompt(choice.key);
    return { ...choice.cat, word: choice.word };
  }

  function showCategory(cat) {
    currentRoundCategory = cat;
    if (!activeCatBadge) return;
    if (!cat) { activeCatBadge.hidden = true; return; }
    const promptText = cat.word || cat.label;
    activeCatText.textContent = `${cat.icon}  ${promptText}`;
    if (activeCatExample) {
      activeCatExample.hidden = !cat.word;
      if (cat.word) activeCatExample.textContent = `Kategorie: ${cat.label}`;
    }
    activeCatBadge.hidden = false;
    // Slide-in Animation neu starten
    activeCatBadge.classList.remove("active-cat--in");
    void activeCatBadge.offsetWidth;
    activeCatBadge.classList.add("active-cat--in");
  }

  function showRevealPrompt(cat, animate) {
    if (!cat) { starterRevealPrompt.hidden = true; return; }
    starterRevealPromptText.textContent = `${cat.icon}  ${cat.word || cat.label}`;
    starterRevealPromptCat.textContent = cat.word ? `Kategorie: ${cat.label}` : "";
    starterRevealPromptCat.hidden = !cat.word;
    starterRevealPrompt.hidden = false;
    if (animate) {
      starterRevealPromptText.classList.remove("starter-reveal__prompt-text--swap");
      void starterRevealPromptText.offsetWidth;
      starterRevealPromptText.classList.add("starter-reveal__prompt-text--swap");
    }
  }

  // Skip vor dem eigentlichen Start: neuen Begriff ziehen, ohne dass der
  // Tipp aufs Reveal (= Timer-Start) mit ausgelöst wird.
  starterRevealSkip.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!starterRevealDismissHandler) return; // Reveal läuft schon raus
    const cat = pickCategory();
    showCategory(cat);
    showRevealPrompt(cat, true);
  });

  /* ------------------------------------------------------------------ */
  /* Tick-Logik                                                           */
  /* ------------------------------------------------------------------ */
  function pulse() {
    bombRing.classList.remove("bomb-ring--pulse");
    void bombRing.offsetWidth;
    bombRing.classList.add("bomb-ring--pulse");
  }

  function scheduleTick(totalMs, startedAt) {
    const remaining = totalMs - (performance.now() - startedAt);
    if (remaining <= 0) { explode(); return; }
    const progress = remaining / totalMs;
    const interval = 150 + 750 * Math.pow(progress, 1.4);
    tickTimeoutId = setTimeout(() => {
      if (!roundActive) return;
      pulse();
      Sound.tick(700 + 500 * (1 - progress));
      scheduleTick(totalMs, startedAt);
    }, interval);
  }

  /* ------------------------------------------------------------------ */
  /* Start-Reveal ("X fängt an") - läuft VOR dem eigentlichen Timer-Start,
     bleibt stehen bis draufgetippt wird (kein Auto-Timeout mehr).         */
  /* ------------------------------------------------------------------ */
  function showStarterReveal(starter, onDone) {
    starterRevealName.textContent = starter ? `${starter} fängt an!` : "Los geht's!";
    starterReveal.classList.remove("starter-reveal--out");
    starterReveal.hidden = false;
    void starterReveal.offsetWidth; // Reflow, damit Wave/Text-Animationen sicher neu starten

    Sound.say(starter ? `${starter} fängt an` : "Los geht's");

    starterRevealDismissHandler = () => {
      starterReveal.removeEventListener("click", starterRevealDismissHandler);
      starterRevealDismissHandler = null;
      starterReveal.classList.add("starter-reveal--out");
      starterRevealOutTimeoutId = setTimeout(() => {
        starterReveal.hidden = true;
        starterReveal.classList.remove("starter-reveal--out");
        onDone();
      }, STARTER_REVEAL_OUT_MS);
    };
    starterReveal.addEventListener("click", starterRevealDismissHandler);
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Steuerung                                                     */
  /* ------------------------------------------------------------------ */
  function startRound() {
    if (playerPicker.getActiveCount() < MIN_PLAYERS || playerPicker.getActiveCount() > MAX_PLAYERS) return;

    const { min, max } = computeFuseRange(playerPicker.getActiveCount());
    const totalMs = (min + Math.random() * (max - min)) * 1000;

    roundActive = true;
    ViewNav.transition(setupView, playView);
    playActions.hidden = true;

    bombRing.classList.remove("bomb-ring--exploded");
    bombIconUse.setAttribute("href", "#icon-bomb");
    playStatus.dataset.exploded = "false";

    // Begriff ziehen und anzeigen (auch schon auf dem Start-Reveal, damit
    // man ihn dort vor dem Timer-Start noch skippen kann)
    const cat = pickCategory();
    showCategory(cat);
    showRevealPrompt(cat, false);

    Sound.unlock();
    WakeLock.enable();

    const selectedNames = playerPicker.getSelectedNames();
    const starter = selectedNames.length > 0
      ? selectedNames[Math.floor(Math.random() * selectedNames.length)]
      : null;

    // Kurz halten - die Spielregel ("Begriff nennen, dann weitergeben")
    // steht schon in der Kategorie-Karte darüber, muss hier nicht nochmal
    // wiederholt werden.
    playStatus.textContent = starter ? `${starter} fängt an!` : "Gib das Handy weiter!";

    // Timer startet erst NACH dem Start-Reveal, nicht schon währenddessen -
    // sonst könnte die Bombe theoretisch schon hochgehen, bevor überhaupt
    // klar ist, wer anfängt.
    showStarterReveal(starter, () => scheduleTick(totalMs, performance.now()));
  }

  function explode() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);

    bombIconUse.setAttribute("href", "#icon-burst");
    bombRing.classList.add("bomb-ring--exploded");
    playStatus.textContent = "💥 BOOM! Die Bombe ist hochgegangen.";
    playStatus.dataset.exploded = "true";
    playActions.hidden = false;

    if (quickRatingEl) quickRatingEl.hidden = true;
    if (currentRoundCategory) {
      GithubFeedback.renderQuickRating(quickRatingEl, {
        gameId: "bombe",
        gameName: "Tickende Bombe",
        categoryLabel: currentRoundCategory.label,
        word: currentRoundCategory.word || currentRoundCategory.label,
      });
    }

    // Screen Shake
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 500);

    // Fullscreen Flash
    const flash = document.createElement("div");
    flash.className = "explosion-flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);

    Sound.boom();
    if (Storage.getSettings().vibrationEnabled && navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 500]);
    }
    WakeLock.disable();
  }

  function stopRound() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);
    if (starterRevealDismissHandler) {
      starterReveal.removeEventListener("click", starterRevealDismissHandler);
      starterRevealDismissHandler = null;
    }
    if (starterRevealOutTimeoutId) { clearTimeout(starterRevealOutTimeoutId); starterRevealOutTimeoutId = null; }
    starterReveal.hidden = true;
    starterReveal.classList.remove("starter-reveal--out");
    WakeLock.disable();
  }

  /* ------------------------------------------------------------------ */
  /* Event-Listener                                                        */
  /* ------------------------------------------------------------------ */
  startButton.addEventListener("click", startRound);
  restartButton.addEventListener("click", startRound);
  exitButton.addEventListener("click", () => { stopRound(); ViewNav.transition(playView, setupView); });

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
      // Runde läuft (oder ist gerade explodiert) -> erst bestätigen lassen,
      // bevor es zurück zur Spiel-Vorbereitung geht.
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die laufende Runde wird abgebrochen.",
        confirmLabel: "Verlassen",
        onConfirm: () => ViewNav.transition(playView, setupView),
      });
      return;
    }
    if (!categorySelectView.hidden || !playerSelectView.hidden) {
      ViewNav.transition(categorySelectView.hidden ? playerSelectView : categorySelectView, setupView);
      return;
    }
    PageTransition.navigate("/");
  });

  // Bestätigung beim System-Zurück (Android/iOS-Zurück-Geste, siehe
  // view-nav.js) – die lässt sich nur synchron per window.confirm()
  // abfangen, ein eigenes Dialogfenster kann die Browser-Navigation nicht
  // rechtzeitig aufhalten.
  window.confirmGameExit = function () {
    if (roundActive) {
      return confirm("Möchtest du das laufende Spiel wirklich beenden?");
    }
    return true;
  };

  playView.addEventListener("viewhide", stopRound);
  window.addEventListener("beforeunload", stopRound, { signal: Router.signal });
  // beforeunload feuert nur bei einem ECHTEN Browser-Reload/-Schließen,
  // nicht bei einem Router-Seitenwechsel (siehe router.js) - deshalb
  // zusätzlich explizit hier abmelden, damit WakeLock nicht aktiv bleibt.
  Router.onTeardown(stopRound);
})();
