/**
 * Werwolf – Einzelgerät-Modus. Ein Handy geht reihum: Rollenverteilung per
 * Wisch-Karte (wie Impostor), danach treibt die App per Sprachansage
 * (Sound.say) und Tipp-Auswahl auf demselben Gerät Nacht/Tag-Phasen voran.
 * Vertrauensmodell wie bei allen bisherigen Spielen: wer das Handy gerade
 * hält, ist die gemeinte Person (kein technischer Schutz, wie überall
 * sonst in dieser App auch).
 */
(function () {
  const SETTINGS_KEY = "anna:werwolf:settings";
  const MIN_PLAYERS = 4;
  const MAX_PLAYERS = 20;

  const ROLE_LABELS = {
    werwolf: "Werwolf",
    dorfbewohner: "Dorfbewohner",
    seherin: "Seherin",
    hexe: "Hexe",
    amor: "Amor",
    jaeger: "Jäger",
  };
  const ROLE_DESCRIPTIONS = {
    werwolf: "Ihr kennt eure Mitwölfe – wählt nachts gemeinsam ein Opfer.",
    dorfbewohner: "Keine besondere Fähigkeit – überzeugt tagsüber mit guten Argumenten!",
    seherin: "Du darfst nachts in die Rolle einer Person schauen.",
    hexe: "Du hast einen Heiltrank und einen Gifttrank – jeweils einmal nutzbar.",
    amor: "Nur in Runde 1: du verkuppelst zwei Spieler. Stirbt einer, stirbt der andere mit.",
    jaeger: "Stirbst du, darfst du sofort noch eine Person mit erschießen.",
  };

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                        */
  /* ------------------------------------------------------------------ */
  const setupView = document.getElementById("setup-view");
  const playerSelectView = document.getElementById("view-player-select");
  const revealView = document.getElementById("view-reveal");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const startButton = document.getElementById("start-button");
  const werwolfCountValue = document.getElementById("werwolf-count-value");
  const werwolfCountMinus = document.getElementById("werwolf-count-minus");
  const werwolfCountPlus = document.getElementById("werwolf-count-plus");
  const toggleSeherin = document.getElementById("role-toggle-seherin");
  const toggleHexe = document.getElementById("role-toggle-hexe");
  const toggleAmor = document.getElementById("role-toggle-amor");
  const toggleJaeger = document.getElementById("role-toggle-jaeger");

  const playerSummary = document.getElementById("player-select-summary");
  const openPlayerSelectBtn = document.getElementById("open-player-select-button");
  const playerBackButton = document.getElementById("player-select-back-button");
  const playerConfirmButton = document.getElementById("player-select-confirm-button");

  const validationWarning = document.getElementById("validation-warning");
  const validationWarningText = document.getElementById("validation-warning-text");

  const revealStageLabel = document.getElementById("reveal-stage-label");
  const revealPlayerName = document.getElementById("reveal-player-name");
  const revealProgress = document.getElementById("reveal-progress");
  const revealCard = document.getElementById("reveal-card");
  const revealCardFront = document.getElementById("reveal-card-front");
  const revealCardBack = document.getElementById("reveal-card-back");
  const revealCardHint = document.getElementById("reveal-card-hint");
  const revealRole = document.getElementById("reveal-role");
  const revealWord = document.getElementById("reveal-word");
  const revealIdentityList = document.getElementById("reveal-identity-list");
  const revealNextButton = document.getElementById("reveal-next-button");

  const werwolfStatus = document.getElementById("werwolf-status");
  const werwolfBody = document.getElementById("werwolf-body");
  const werwolfActions = document.getElementById("werwolf-actions");
  const werwolfEndActions = document.getElementById("werwolf-end-actions");
  const restartButton = document.getElementById("restart-button");
  const exitButton = document.getElementById("exit-button");

  // Online-Mehrgeräte-Modus (siehe Abschnitt weiter unten)
  const modeSelect = document.getElementById("werwolf-mode-select");
  const onlineHostNameRow = document.getElementById("online-host-name-row");
  const onlineHostNameInput = document.getElementById("online-host-name-input");
  const onlineAnnounceRow = document.getElementById("online-announce-row");
  const onlineAnnounceToggle = document.getElementById("online-announce-toggle");
  const muteToggleButton = document.getElementById("mute-toggle-button");
  const onlineLobbyView = document.getElementById("view-online-lobby");
  const onlinePlayView = document.getElementById("view-online-play");
  const onlineHostPanel = document.getElementById("online-host-panel");
  const onlineJoinForm = document.getElementById("online-join-form");
  const onlineJoinNameInput = document.getElementById("online-join-name-input");
  const onlineJoinSubmitButton = document.getElementById("online-join-submit-button");
  const onlineJoinError = document.getElementById("online-join-error");
  const onlinePlayerListPanel = document.getElementById("online-player-list-panel");
  const onlinePlayerCount = document.getElementById("online-player-count");
  const onlinePlayerList = document.getElementById("online-player-list");
  const onlineWaitingText = document.getElementById("online-waiting-text");
  const onlineLobbyActions = document.getElementById("online-lobby-actions");
  const onlineStartButton = document.getElementById("online-start-button");
  const werwolfQrWrap = document.getElementById("werwolf-qr-wrap");
  const werwolfJoinLinkInput = document.getElementById("werwolf-join-link-input");
  const werwolfCopyLinkButton = document.getElementById("werwolf-copy-link-button");
  const werwolfShortCodeText = document.getElementById("werwolf-short-code-text");
  const onlineJoinByCodeButton = document.getElementById("online-join-by-code-button");
  const onlineCodeJoinForm = document.getElementById("online-code-join-form");
  const onlineCodeInput = document.getElementById("online-code-input");
  const onlineCodeNameInput = document.getElementById("online-code-name-input");
  const onlineCodeJoinSubmitButton = document.getElementById("online-code-join-submit-button");
  const onlineCodeJoinError = document.getElementById("online-code-join-error");
  const onlineStatusText = document.getElementById("online-status-text");
  const onlineBody = document.getElementById("online-body");
  const onlineActions = document.getElementById("online-actions");
  const onlineEndActions = document.getElementById("online-end-actions");
  const onlineRestartButton = document.getElementById("online-restart-button");
  const onlineExitButton = document.getElementById("online-exit-button");

  const playerPicker = PlayerPicker.create();

  // Muss vor updatePlayerSummary() (siehe unten, wird schon beim Laden
  // einmal aufgerufen) initialisiert sein, sonst ReferenceError durch die
  // "temporal dead zone" von let - und JEDE Event-Listener-Registrierung
  // danach im Skript würde nie ausgeführt.
  let mode = "local";

  /* ------------------------------------------------------------------ */
  /* Einstellungen laden / speichern                                      */
  /* ------------------------------------------------------------------ */
  function loadRoleConfig() {
    try {
      return Object.assign(
        { werwolfCount: 1, seherin: false, hexe: false, amor: false, jaeger: false },
        JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
      );
    } catch {
      return { werwolfCount: 1, seherin: false, hexe: false, amor: false, jaeger: false };
    }
  }
  function saveRoleConfig() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(roleConfig)); }

  const roleConfig = loadRoleConfig();
  toggleSeherin.checked = roleConfig.seherin;
  toggleHexe.checked = roleConfig.hexe;
  toggleAmor.checked = roleConfig.amor;
  toggleJaeger.checked = roleConfig.jaeger;

  function maxWerewolvesFor(playerCount) {
    return Math.max(1, Math.min(Math.floor(playerCount / 3), 6));
  }

  function renderWerwolfCount() {
    werwolfCountValue.textContent = String(roleConfig.werwolfCount);
    const max = maxWerewolvesFor(Math.max(playerPicker.getActiveCount(), MIN_PLAYERS));
    werwolfCountMinus.disabled = roleConfig.werwolfCount <= 1;
    werwolfCountPlus.disabled = roleConfig.werwolfCount >= max;
  }

  werwolfCountMinus.addEventListener("click", () => {
    if (roleConfig.werwolfCount <= 1) return;
    roleConfig.werwolfCount -= 1;
    saveRoleConfig();
    renderWerwolfCount();
  });
  werwolfCountPlus.addEventListener("click", () => {
    const max = maxWerewolvesFor(Math.max(playerPicker.getActiveCount(), MIN_PLAYERS));
    if (roleConfig.werwolfCount >= max) return;
    roleConfig.werwolfCount += 1;
    saveRoleConfig();
    renderWerwolfCount();
  });
  [["seherin", toggleSeherin], ["hexe", toggleHexe], ["amor", toggleAmor], ["jaeger", toggleJaeger]].forEach(([key, el]) => {
    el.addEventListener("change", () => { roleConfig[key] = el.checked; saveRoleConfig(); });
  });

  /* ------------------------------------------------------------------ */
  /* Mitspieler                                                            */
  /* ------------------------------------------------------------------ */
  function updatePlayerSummary() {
    const count = playerPicker.getActiveCount();
    playerSummary.textContent = count === 1 ? "1 Spieler ausgewählt" : `${count} Spieler ausgewählt`;

    const valid = count >= MIN_PLAYERS && count <= MAX_PLAYERS;
    validationWarning.hidden = valid || mode !== "local";
    if (!valid) {
      validationWarningText.textContent = count < MIN_PLAYERS
        ? `Mindestens ${MIN_PLAYERS} Mitspieler nötig (aktuell ${count}).`
        : `Höchstens ${MAX_PLAYERS} Mitspieler möglich (aktuell ${count}).`;
    }
    if (mode === "local") startButton.disabled = !valid;
    renderWerwolfCount();
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Modus-Auswahl (Einzelgerät / Online)                                  */
  /* ------------------------------------------------------------------ */
  function updateModeUI() {
    const isOnline = mode === "online";
    openPlayerSelectBtn.hidden = isOnline;
    onlineHostNameRow.hidden = !isOnline;
    onlineAnnounceRow.hidden = !isOnline;
    onlineJoinByCodeButton.hidden = !isOnline;
    validationWarning.hidden = isOnline || validationWarning.hidden;
    startButton.innerHTML = isOnline
      ? `<svg class="m3-icon" style="width: 18px; height: 18px"><use href="#icon-users"></use></svg> Online-Runde erstellen`
      : `<svg class="m3-icon" style="width: 18px; height: 18px"><use href="#icon-play"></use></svg> Runde starten`;
    startButton.disabled = isOnline ? false : !(playerPicker.getActiveCount() >= MIN_PLAYERS && playerPicker.getActiveCount() <= MAX_PLAYERS);
  }

  modeSelect.addEventListener("click", (event) => {
    const btn = event.target.closest(".m3-segmented__option");
    if (!btn) return;
    mode = btn.dataset.mode;
    modeSelect.querySelectorAll(".m3-segmented__option").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    updateModeUI();
  });

  /* ------------------------------------------------------------------ */
  /* Hilfsfunktionen                                                       */
  /* ------------------------------------------------------------------ */
  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  function narrate(text) {
    werwolfStatus.textContent = text;
    Sound.say(text);
  }

  /* ------------------------------------------------------------------ */
  /* Wisch-nach-oben-Karte (identisch zu Impostor/Wer-bin-ich)             */
  /* ------------------------------------------------------------------ */
  function setupSwipeReveal(cardEl, coverEl, onPeek, onRelease) {
    const THRESHOLD = 60;
    let dragging = false;
    let startY = 0;
    let deltaY = 0;
    let revealed = false;

    function resetTransform() {
      coverEl.style.transform = "";
      coverEl.style.transition = "transform 0.25s var(--m3-easing-emphasized)";
      cardEl.classList.remove("reveal-card--dragging");
    }

    cardEl.addEventListener("pointerdown", (event) => {
      dragging = true;
      startY = event.clientY;
      deltaY = 0;
      revealed = false;
      coverEl.style.transition = "none";
      cardEl.classList.add("reveal-card--dragging");
      cardEl.setPointerCapture(event.pointerId);
    });

    cardEl.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      deltaY = Math.min(0, event.clientY - startY);
      const maxDrag = -cardEl.offsetHeight + 40;
      const moveY = Math.max(deltaY, maxDrag);
      coverEl.style.transform = `translateY(${moveY}px)`;
      if (!revealed && Math.abs(deltaY) > THRESHOLD) {
        revealed = true;
        onPeek();
      } else if (revealed && Math.abs(deltaY) <= THRESHOLD) {
        revealed = false;
        onRelease(false);
      }
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      resetTransform();
      if (revealed) {
        revealed = false;
        onRelease(true);
      }
      deltaY = 0;
    }

    cardEl.addEventListener("pointerup", endDrag);
    cardEl.addEventListener("pointercancel", endDrag);
    cardEl.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Zustand                                                        */
  /* ------------------------------------------------------------------ */
  let roundPlayers = [];
  let roles = [];
  let alive = [];
  let loveLink = null;
  let witchHealUsed = false;
  let witchPoisonUsed = false;
  let round = 1;
  let step = "";
  let nightVictimIdx = null;
  let nightHealed = false;
  let nightPoisonIdx = null;
  let pendingHunterIdx = [];
  let lastDeaths = [];

  function buildRoles(count) {
    const bag = [];
    for (let i = 0; i < roleConfig.werwolfCount; i++) bag.push("werwolf");
    if (roleConfig.seherin) bag.push("seherin");
    if (roleConfig.hexe) bag.push("hexe");
    if (roleConfig.amor) bag.push("amor");
    if (roleConfig.jaeger) bag.push("jaeger");
    if (bag.length > count) return null;
    while (bag.length < count) bag.push("dorfbewohner");
    return shuffle(bag);
  }

  function roleIndex(role) { return roles.indexOf(role); }
  function isRoleAliveAndPresent(role) {
    const idx = roleIndex(role);
    return idx !== -1 && alive[idx];
  }

  /* ------------------------------------------------------------------ */
  /* Rollen-Weitergabe (eigene Rolle, danach Werwolf-Rudel)                */
  /* ------------------------------------------------------------------ */
  let revealStage = "self";
  let wolfIndices = [];
  let currentRevealIndex = 0;

  function renderWolfList(container, excludeIdx) {
    container.innerHTML = wolfIndices
      .filter((i) => i !== excludeIdx)
      .map((i) => `
        <div class="identity-list__item">
          <span class="identity-list__name">${escapeHtml(roundPlayers[i])}</span>
          <span class="identity-list__value">🐺 Werwolf</span>
        </div>
      `)
      .join("");
  }

  function showRevealForCurrentPlayer() {
    revealCard.classList.remove("reveal-card--revealed");
    revealCardBack.hidden = false;
    revealCardFront.hidden = false;
    revealNextButton.hidden = true;
    delete revealCard.dataset.peeked;

    if (revealStage === "self") {
      const idx = currentRevealIndex;
      revealStageLabel.textContent = "Gib das Handy weiter an";
      revealPlayerName.textContent = roundPlayers[idx];
      revealProgress.textContent = `${idx + 1} / ${roundPlayers.length}`;
      revealRole.textContent = ROLE_LABELS[roles[idx]];
      revealWord.textContent = ROLE_DESCRIPTIONS[roles[idx]];
      revealWord.hidden = false;
      revealIdentityList.hidden = true;
      revealCardHint.innerHTML = "Nach oben wischen und halten,<br/>um deine Rolle zu sehen";
    } else {
      const idx = wolfIndices[currentRevealIndex];
      revealStageLabel.textContent = "Werwölfe – gib weiter an";
      revealPlayerName.textContent = roundPlayers[idx];
      revealProgress.textContent = `${currentRevealIndex + 1} / ${wolfIndices.length}`;
      revealRole.textContent = "Eure Mitwölfe:";
      revealWord.hidden = true;
      revealIdentityList.hidden = false;
      renderWolfList(revealIdentityList, idx);
      revealCardHint.innerHTML = "Nach oben wischen und halten,<br/>um eure Mitwölfe zu sehen";
    }
  }

  function peekCurrentPlayer() {
    revealCard.classList.add("reveal-card--revealed");
    if (!revealCard.dataset.peeked) {
      revealCard.dataset.peeked = "true";
      Sound.beep(720, 0.1);
      if (Storage.getSettings().vibrationEnabled && navigator.vibrate) navigator.vibrate(30);
    }
  }

  function hideCurrentPlayer(finished) {
    revealCard.classList.remove("reveal-card--revealed");
    if (finished || revealCard.dataset.peeked) {
      revealNextButton.hidden = false;
      revealCardHint.innerHTML = "Erneut ansehen<br/>(Wischen &amp; Halten)";
    }
  }

  setupSwipeReveal(revealCard, revealCardFront, peekCurrentPlayer, hideCurrentPlayer);

  revealNextButton.addEventListener("click", () => {
    if (mode === "online") return; // Online-Reveal hat seinen eigenen Handler (siehe unten, per .onclick gesetzt)
    currentRevealIndex += 1;
    const total = revealStage === "self" ? roundPlayers.length : wolfIndices.length;
    if (currentRevealIndex < total) {
      showRevealForCurrentPlayer();
    } else if (revealStage === "self" && wolfIndices.length > 1) {
      revealStage = "wolfpack";
      currentRevealIndex = 0;
      showRevealForCurrentPlayer();
    } else {
      ViewNav.transition(revealView, playView);
      startNight();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Auswahl-Liste (Werwolf-Opfer, Seherin-Blick, Hexe-Gift, Tag-Votum …)  */
  /* ------------------------------------------------------------------ */
  function renderChoiceList(options, { multiple = false, skipLabel = null, onConfirm }) {
    let selected = [];

    function updateActions() {
      if (!multiple) { werwolfActions.hidden = true; werwolfActions.innerHTML = ""; return; }
      if (selected.length === 2) {
        werwolfActions.hidden = false;
        werwolfActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="choice-confirm-button">Bestätigen</button>`;
        document.getElementById("choice-confirm-button").addEventListener("click", () => onConfirm([...selected]));
      } else {
        werwolfActions.hidden = true;
        werwolfActions.innerHTML = "";
      }
    }

    function draw() {
      werwolfBody.innerHTML = `
        <div class="werwolf-choice-list">
          ${options.map((o) => `
            <button type="button" class="m3-button m3-button--tonal werwolf-choice-list__btn" data-idx="${o.idx}" data-selected="${selected.includes(o.idx)}">${escapeHtml(o.label)}</button>
          `).join("")}
          ${skipLabel ? `<button type="button" class="m3-button m3-button--text" data-skip="true">${escapeHtml(skipLabel)}</button>` : ""}
        </div>
      `;
    }

    draw();
    updateActions();

    werwolfBody.onclick = (event) => {
      const skipBtn = event.target.closest("[data-skip]");
      if (skipBtn) { onConfirm(null); return; }
      const btn = event.target.closest("[data-idx]");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      if (!multiple) { onConfirm(idx); return; }
      if (selected.includes(idx)) selected = selected.filter((i) => i !== idx);
      else if (selected.length < 2) selected = [...selected, idx];
      draw();
      updateActions();
    };
  }

  function alivePlayers(filterFn) {
    return roundPlayers
      .map((name, idx) => ({ name, idx }))
      .filter(({ idx }) => alive[idx] && (!filterFn || filterFn(idx)));
  }

  /* ------------------------------------------------------------------ */
  /* Nacht/Tag-Zustandsmaschine                                            */
  /* ------------------------------------------------------------------ */
  function goToStep(newStep) {
    step = newStep;
    werwolfActions.hidden = true;
    werwolfActions.innerHTML = "";
    renderStep();
  }

  function startNight() {
    nightVictimIdx = null;
    nightHealed = false;
    nightPoisonIdx = null;
    if (round === 1 && roleConfig.amor && !loveLink) {
      goToStep("amor");
    } else {
      goToStep("werwolf");
    }
  }

  function afterWerwolf() {
    if (isRoleAliveAndPresent("seherin")) goToStep("seherin");
    else if (isRoleAliveAndPresent("hexe")) goToStep("hexe-heal");
    else resolveNight();
  }

  function afterSeherin() {
    if (isRoleAliveAndPresent("hexe")) goToStep("hexe-heal");
    else resolveNight();
  }

  function resolveLoveChain(deaths) {
    let changed = true;
    while (changed) {
      changed = false;
      if (loveLink) {
        const [a, b] = loveLink;
        if (deaths.has(a) && alive[b] && !deaths.has(b)) { deaths.add(b); changed = true; }
        if (deaths.has(b) && alive[a] && !deaths.has(a)) { deaths.add(a); changed = true; }
      }
    }
    return deaths;
  }

  function resolveNight() {
    let deaths = new Set();
    if (nightVictimIdx !== null && !nightHealed) deaths.add(nightVictimIdx);
    if (nightPoisonIdx !== null) deaths.add(nightPoisonIdx);
    deaths = resolveLoveChain(deaths);

    lastDeaths = [...deaths];
    lastDeaths.forEach((i) => { alive[i] = false; });
    pendingHunterIdx = lastDeaths.filter((i) => roles[i] === "jaeger");
    goToStep("day-reveal");
  }

  function afterDayReveal() {
    if (checkWin()) return;
    if (pendingHunterIdx.length) goToStep("hunter-shot");
    else goToStep("day-discussion");
  }

  function checkWin() {
    const aliveWolves = roles.filter((r, i) => r === "werwolf" && alive[i]).length;
    const aliveOthers = roles.filter((r, i) => r !== "werwolf" && alive[i]).length;
    if (aliveWolves === 0) { endGame("dorf"); return true; }
    if (aliveWolves >= aliveOthers) { endGame("werwolf"); return true; }
    return false;
  }

  function endGame(winner) {
    step = "ended";
    const title = winner === "dorf" ? "Das Dorf hat gewonnen!" : "Die Werwölfe haben gewonnen!";
    narrate(title);
    const rolesList = roundPlayers
      .map((name, i) => `<div class="identity-list__item"><span class="identity-list__name">${escapeHtml(name)}</span><span class="identity-list__value">${ROLE_LABELS[roles[i]]}${alive[i] ? "" : " · ☠"}</span></div>`)
      .join("");
    werwolfBody.innerHTML = `
      <div class="werwolf-result-card">
        <p class="m3-headline">${escapeHtml(title)}</p>
        <div class="identity-list">${rolesList}</div>
      </div>
    `;
    werwolfActions.hidden = true;
    werwolfEndActions.hidden = false;
  }

  function renderStep() {
    werwolfEndActions.hidden = true;
    switch (step) {
      case "amor": {
        narrate("Amor, wach auf. Wähle zwei Verliebte.");
        const options = roundPlayers.map((name, idx) => ({ name, idx })).filter(({ idx }) => alive[idx]).map(({ name, idx }) => ({ label: name, idx }));
        renderChoiceList(options, {
          multiple: true,
          onConfirm: (pair) => {
            loveLink = pair;
            narrate("Amor schläft wieder ein.");
            goToStep("werwolf");
          },
        });
        break;
      }
      case "werwolf": {
        narrate("Alle schlafen ein. Die Werwölfe wachen auf und wählen ihr Opfer.");
        const options = alivePlayers((idx) => roles[idx] !== "werwolf").map(({ name, idx }) => ({ label: name, idx }));
        renderChoiceList(options, {
          onConfirm: (idx) => {
            nightVictimIdx = idx;
            narrate("Die Werwölfe schlafen wieder ein.");
            afterWerwolf();
          },
        });
        break;
      }
      case "seherin": {
        narrate("Die Seherin wacht auf. Wessen Rolle möchtest du sehen?");
        const seerIdx = roleIndex("seherin");
        const options = alivePlayers((idx) => idx !== seerIdx).map(({ name, idx }) => ({ label: name, idx }));
        renderChoiceList(options, {
          onConfirm: (idx) => {
            werwolfBody.innerHTML = `
              <div class="werwolf-result-card">
                <p class="m3-body">${escapeHtml(roundPlayers[idx])} ist:</p>
                <p class="m3-headline">${ROLE_LABELS[roles[idx]]}</p>
              </div>
            `;
            werwolfActions.hidden = false;
            werwolfActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="seherin-continue-button">Weiter</button>`;
            document.getElementById("seherin-continue-button").addEventListener("click", () => {
              narrate("Die Seherin schläft wieder ein.");
              afterSeherin();
            });
          },
        });
        break;
      }
      case "hexe-heal": {
        if (witchHealUsed || nightVictimIdx === null) { goToStep("hexe-poison"); return; }
        narrate(`Die Hexe wacht auf. Die Werwölfe haben ${roundPlayers[nightVictimIdx]} gewählt. Heiltrank einsetzen?`);
        werwolfBody.innerHTML = "";
        werwolfActions.hidden = false;
        werwolfActions.innerHTML = `
          <button type="button" class="m3-button m3-button--filled" id="witch-heal-yes">Ja, retten</button>
          <button type="button" class="m3-button m3-button--text" id="witch-heal-no" style="margin-top: 8px">Nein</button>
        `;
        document.getElementById("witch-heal-yes").addEventListener("click", () => {
          nightHealed = true;
          witchHealUsed = true;
          goToStep("hexe-poison");
        });
        document.getElementById("witch-heal-no").addEventListener("click", () => goToStep("hexe-poison"));
        break;
      }
      case "hexe-poison": {
        if (witchPoisonUsed) { narrate("Die Hexe schläft wieder ein."); resolveNight(); return; }
        narrate("Möchtest du zusätzlich jemanden vergiften?");
        const options = alivePlayers((idx) => idx !== nightVictimIdx || nightHealed).map(({ name, idx }) => ({ label: name, idx }));
        renderChoiceList(options, {
          skipLabel: "Niemand – überspringen",
          onConfirm: (idx) => {
            if (idx !== null) { nightPoisonIdx = idx; witchPoisonUsed = true; }
            narrate("Die Hexe schläft wieder ein.");
            resolveNight();
          },
        });
        break;
      }
      case "day-reveal": {
        if (!lastDeaths.length) {
          narrate("Es wird Tag. Alle haben die Nacht überlebt!");
          werwolfBody.innerHTML = "";
        } else {
          const names = lastDeaths.map((i) => roundPlayers[i]).join(", ");
          narrate(`Es wird Tag. ${names} ${lastDeaths.length === 1 ? "ist gestorben" : "sind gestorben"}.`);
          werwolfBody.innerHTML = `
            <div class="werwolf-death-list">
              ${lastDeaths.map((i) => `<div class="werwolf-death-list__item">${escapeHtml(roundPlayers[i])} war ${ROLE_LABELS[roles[i]]}</div>`).join("")}
            </div>
          `;
        }
        werwolfActions.hidden = false;
        werwolfActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="day-reveal-continue-button">Weiter</button>`;
        document.getElementById("day-reveal-continue-button").addEventListener("click", afterDayReveal);
        break;
      }
      case "hunter-shot": {
        const hunterIdx = pendingHunterIdx[0];
        narrate(`${roundPlayers[hunterIdx]} war der Jäger und darf noch einmal schießen!`);
        const options = alivePlayers(() => true).map(({ name, idx }) => ({ label: name, idx }));
        renderChoiceList(options, {
          onConfirm: (idx) => {
            alive[idx] = false;
            let deaths = new Set([idx]);
            deaths = resolveLoveChain(deaths);
            deaths.forEach((i) => { alive[i] = false; });
            lastDeaths = [...new Set([...lastDeaths, ...deaths])];
            pendingHunterIdx.shift();
            deaths.forEach((i) => { if (roles[i] === "jaeger" && i !== hunterIdx) pendingHunterIdx.push(i); });
            if (checkWin()) return;
            if (pendingHunterIdx.length) goToStep("hunter-shot");
            else goToStep("day-discussion");
          },
        });
        break;
      }
      case "day-discussion": {
        narrate("Diskutiert am Tisch, wer verdächtig ist.");
        werwolfBody.innerHTML = `<p class="m3-body">Wenn ihr fertig diskutiert habt, geht's zur Abstimmung.</p>`;
        werwolfActions.hidden = false;
        werwolfActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="to-vote-button">Zur Abstimmung</button>`;
        document.getElementById("to-vote-button").addEventListener("click", () => goToStep("day-vote"));
        break;
      }
      case "day-vote": {
        narrate("Wer soll gehängt werden?");
        const options = alivePlayers(() => true).map(({ name, idx }) => ({ label: name, idx }));
        renderChoiceList(options, {
          skipLabel: "Niemand – keine Hinrichtung",
          onConfirm: (idx) => {
            if (idx === null) {
              lastDeaths = [];
              narrate("Niemand wurde gehängt.");
            } else {
              let deaths = new Set([idx]);
              deaths = resolveLoveChain(deaths);
              deaths.forEach((i) => { alive[i] = false; });
              lastDeaths = [...deaths];
              narrate(`${roundPlayers[idx]} wurde gehängt und war ${ROLE_LABELS[roles[idx]]}.`);
              pendingHunterIdx = lastDeaths.filter((i) => roles[i] === "jaeger");
            }
            if (checkWin()) return;
            if (pendingHunterIdx.length) { goToStep("hunter-shot"); return; }
            round += 1;
            startNight();
          },
        });
        break;
      }
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Start                                                          */
  /* ------------------------------------------------------------------ */
  function beginRound() {
    const activePlayers = playerPicker.getSelectedNames();
    const builtRoles = buildRoles(activePlayers.length);
    if (!builtRoles) {
      Toast.show("Zu viele Rollen für so wenige Spieler ausgewählt", "alert-triangle");
      return;
    }

    roundPlayers = shuffle(activePlayers);
    roles = builtRoles;
    alive = roundPlayers.map(() => true);
    loveLink = null;
    witchHealUsed = false;
    witchPoisonUsed = false;
    round = 1;
    lastDeaths = [];
    pendingHunterIdx = [];

    revealStage = "self";
    currentRevealIndex = 0;
    wolfIndices = roles.map((r, i) => (r === "werwolf" ? i : -1)).filter((i) => i !== -1);

    ViewNav.transition(null, revealView);
    showRevealForCurrentPlayer();
  }

  startButton.addEventListener("click", () => {
    if (mode === "online") {
      createOnlineRoom();
      return;
    }
    const count = playerPicker.getActiveCount();
    if (count < MIN_PLAYERS || count > MAX_PLAYERS) return;
    beginRound();
  });

  restartButton.addEventListener("click", beginRound);
  exitButton.addEventListener("click", () => { window.location.href = "/"; });

  /* ------------------------------------------------------------------ */
  /* Zurück-Navigation                                                     */
  /* ------------------------------------------------------------------ */
  backButton.addEventListener("click", () => {
    if ((!onlineLobbyView.hidden || !onlinePlayView.hidden) && setupView.hidden) {
      if (!onlineJoinForm.hidden || !onlineCodeJoinForm.hidden) {
        resetOnlineState();
        ViewNav.transition(onlineLobbyView, setupView);
        return;
      }
      ConfirmDialog.show({
        title: onlineIsHost ? "Runde für alle beenden?" : "Online-Runde verlassen?",
        message: onlineIsHost
          ? "Als Host beendest du die Runde damit für alle Mitspieler."
          : "Du verlässt die Runde auf diesem Gerät. Andere können weiterspielen.",
        confirmLabel: onlineIsHost ? "Runde beenden" : "Verlassen",
        onConfirm: () => { leaveOrEndOnlineRoom(); stopOnlineStream(); window.location.href = "/"; },
      });
      return;
    }
    if (!revealView.hidden && setupView.hidden) {
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die Rollen-Weitergabe wird abgebrochen.",
        confirmLabel: "Verlassen",
        onConfirm: () => { window.location.href = "/"; },
      });
      return;
    }
    if (!playView.hidden && setupView.hidden) {
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die laufende Runde wird abgebrochen.",
        confirmLabel: "Verlassen",
        onConfirm: () => { window.location.href = "/"; },
      });
      return;
    }
    if (!playerSelectView.hidden) {
      ViewNav.transition(playerSelectView, setupView);
      return;
    }
    window.location.href = "/";
  });

  // Bestätigung beim System-Zurück (Android/iOS-Zurück-Geste, siehe
  // view-nav.js) – die lässt sich nur synchron per window.confirm()
  // abfangen, ein eigenes Dialogfenster kann die Browser-Navigation nicht
  // rechtzeitig aufhalten.
  window.confirmGameExit = function () {
    const currentActive = document.querySelector(".app-view:not([hidden])");
    if (!currentActive) return true;
    if (currentActive.id === "view-reveal" && mode === "online") return true; // eigener Reveal, kein Gruppenzustand
    if (["view-reveal", "play-view", "view-online-lobby", "view-online-play"].includes(currentActive.id)) {
      if (!onlineJoinForm.hidden || !onlineCodeJoinForm.hidden) {
        resetOnlineState();
        return true;
      }
      const leaving = confirm("Möchtest du das laufende Spiel wirklich beenden?");
      if (leaving && ["view-online-lobby", "view-online-play"].includes(currentActive.id)) {
        leaveOrEndOnlineRoom();
        stopOnlineStream();
      }
      return leaving;
    }
    return true;
  };

  /* ==================================================================== */
  /* Online-Mehrgeräte-Modus                                               */
  /* ==================================================================== */

  function sessionKey(token) { return `anna:werwolf:session:${token}`; }
  function saveSession(token, data) { localStorage.setItem(sessionKey(token), JSON.stringify(data)); }
  function loadSession(token) {
    try { return JSON.parse(localStorage.getItem(sessionKey(token)) || "null"); } catch { return null; }
  }
  function clearSession(token) { localStorage.removeItem(sessionKey(token)); }

  function isOnlineMuted() { return localStorage.getItem("anna:werwolf:muted") === "1"; }

  function updateMuteButton() {
    const muted = isOnlineMuted();
    muteToggleButton.innerHTML = `<svg class="m3-icon"><use href="#icon-sound-${muted ? "off" : "on"}"></use></svg>`;
    muteToggleButton.setAttribute("aria-label", muted ? "Ansagen einschalten" : "Ansagen stummschalten");
  }
  updateMuteButton();

  muteToggleButton.addEventListener("click", () => {
    localStorage.setItem("anna:werwolf:muted", isOnlineMuted() ? "0" : "1");
    updateMuteButton();
  });

  async function apiPost(path, body) {
    const res = await fetch(`/api/werwolf${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    let data = {};
    try { data = await res.json(); } catch { /* leere Antwort */ }
    if (!res.ok) throw new Error(data.error || `Fehler (${res.status})`);
    return data;
  }

  let onlineRoomToken = null;
  let onlineHostToken = null;
  let onlinePlayerToken = null;
  let onlineIsHost = false;
  let onlineEventSource = null;
  let onlineLatestSnapshot = null;
  let onlineRoleRevealShown = false;
  let onlineRoleAcked = false;
  let onlineLastNarrated = "";
  let onlinePrivateResultPending = false;

  function onlineJoinUrl(token) {
    return `${window.location.origin}/werwolf/join/${token}`;
  }

  function detectJoinToken() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "werwolf" && parts[1] === "join" && parts[2]) return parts[2];
    return null;
  }

  function showOnlineView(viewEl) {
    [setupView, playerSelectView, revealView, playView, onlineLobbyView, onlinePlayView].forEach((v) => {
      v.hidden = v !== viewEl;
    });
    const topbar = document.getElementById("game-topbar");
    if (topbar) topbar.hidden = false;
  }

  /* ---------------- Host: Raum erstellen ---------------- */
  let creatingOnlineRoom = false;

  async function createOnlineRoom() {
    // Schützt gegen Doppelklick/ungeduldiges Mehrfachtippen, während die
    // erste Anfrage noch läuft - sonst könnten zwei Räume gleichzeitig
    // entstehen und Anzeige/gespeicherter Token durcheinandergeraten.
    if (creatingOnlineRoom) return;
    creatingOnlineRoom = true;
    startButton.disabled = true;

    resetOnlineState();

    const hostName = onlineHostNameInput.value.trim() || "Host";
    let created;
    try {
      created = await apiPost("/rooms", { hostName });
      await apiPost(`/rooms/${created.roomToken}/config`, {
        hostToken: created.hostToken,
        roleConfig: { ...roleConfig },
        announceAllDevices: onlineAnnounceToggle.checked,
      });
    } catch (err) {
      Toast.show(err.message, "alert-triangle");
      creatingOnlineRoom = false;
      startButton.disabled = false;
      return;
    }
    creatingOnlineRoom = false;
    startButton.disabled = false;
    onlineRoomToken = created.roomToken;
    onlineHostToken = created.hostToken;
    onlinePlayerToken = created.playerToken;
    onlineIsHost = true;
    saveSession(onlineRoomToken, { playerToken: onlinePlayerToken, hostToken: onlineHostToken, isHost: true });

    showOnlineView(onlineLobbyView);
    onlineHostPanel.hidden = false;
    onlineJoinForm.hidden = true;
    onlinePlayerListPanel.hidden = false;
    renderQrAndLink(onlineRoomToken);
    startOnlineStream();
  }

  function renderQrAndLink(token) {
    const url = onlineJoinUrl(token);
    werwolfJoinLinkInput.value = url;
    werwolfQrWrap.innerHTML = "";
    try {
      let typeNumber = 4;
      let qr = null;
      while (typeNumber <= 40) {
        try {
          qr = qrcode(typeNumber, "M");
          qr.addData(url);
          qr.make();
          break;
        } catch (e) {
          qr = null;
          typeNumber += 1;
        }
      }
      if (qr) werwolfQrWrap.innerHTML = qr.createSvgTag(4, 8);
    } catch (e) {
      /* QR-Code ist ein Extra, der Link allein funktioniert trotzdem. */
    }
  }

  werwolfCopyLinkButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(werwolfJoinLinkInput.value);
      Toast.show("Link kopiert", "check");
    } catch (e) {
      werwolfJoinLinkInput.select();
      try { document.execCommand("copy"); Toast.show("Link kopiert", "check"); } catch (e2) { /* Zwischenablage nicht verfügbar */ }
    }
  });

  /* ---------------- Beitreten über Join-Link ---------------- */
  function enterAsJoiner(token) {
    resetOnlineState();
    mode = "online";
    onlineRoomToken = token;
    showOnlineView(onlineLobbyView);
    onlineHostPanel.hidden = true;

    const saved = loadSession(token);
    if (saved && saved.playerToken) {
      onlinePlayerToken = saved.playerToken;
      onlineHostToken = saved.hostToken || null;
      onlineIsHost = !!saved.isHost;
      rejoinRoom();
    } else {
      showJoinForm();
    }
  }

  function showJoinForm() {
    onlineJoinForm.hidden = false;
    onlinePlayerListPanel.hidden = true;
  }

  async function rejoinRoom() {
    try {
      const snap = await apiPost(`/rooms/${onlineRoomToken}/rejoin`, { playerToken: onlinePlayerToken });
      onlineIsHost = snap.isHost;
      onlineJoinForm.hidden = true;
      onlinePlayerListPanel.hidden = false;
      startOnlineStream();
    } catch (err) {
      clearSession(onlineRoomToken);
      showJoinForm();
    }
  }

  onlineJoinNameInput.addEventListener("input", () => { onlineJoinError.hidden = true; });

  onlineJoinSubmitButton.addEventListener("click", async () => {
    const name = onlineJoinNameInput.value.trim();
    onlineJoinError.hidden = true;
    if (!name) {
      onlineJoinError.textContent = "Bitte einen Namen eingeben";
      onlineJoinError.hidden = false;
      return;
    }
    try {
      const r = await apiPost(`/rooms/${onlineRoomToken}/join`, { name });
      onlinePlayerToken = r.playerToken;
      onlineIsHost = false;
      saveSession(onlineRoomToken, { playerToken: onlinePlayerToken, isHost: false });
      onlineJoinForm.hidden = true;
      onlinePlayerListPanel.hidden = false;
      startOnlineStream();
    } catch (err) {
      onlineJoinError.textContent = err.message;
      onlineJoinError.hidden = false;
    }
  });

  /* ---------------- Beitreten über 6-stelligen Code ---------------- */
  onlineJoinByCodeButton.addEventListener("click", () => {
    resetOnlineState();
    showOnlineView(onlineLobbyView);
    onlineHostPanel.hidden = true;
    onlineJoinForm.hidden = true;
    onlinePlayerListPanel.hidden = true;
    onlineCodeJoinForm.hidden = false;
    onlineCodeInput.focus();
  });

  onlineCodeInput.addEventListener("input", () => { onlineCodeJoinError.hidden = true; });
  onlineCodeNameInput.addEventListener("input", () => { onlineCodeJoinError.hidden = true; });

  onlineCodeJoinSubmitButton.addEventListener("click", async () => {
    const code = onlineCodeInput.value.trim();
    const name = onlineCodeNameInput.value.trim();
    onlineCodeJoinError.hidden = true;
    if (!/^\d{6}$/.test(code)) {
      onlineCodeJoinError.textContent = "Bitte den 6-stelligen Code eingeben";
      onlineCodeJoinError.hidden = false;
      return;
    }
    if (!name) {
      onlineCodeJoinError.textContent = "Bitte einen Namen eingeben";
      onlineCodeJoinError.hidden = false;
      return;
    }
    try {
      const r = await apiPost("/join-by-code", { code, name });
      onlineRoomToken = r.roomToken;
      onlinePlayerToken = r.playerToken;
      onlineIsHost = false;
      saveSession(onlineRoomToken, { playerToken: onlinePlayerToken, isHost: false });
      onlineCodeJoinForm.hidden = true;
      onlinePlayerListPanel.hidden = false;
      startOnlineStream();
    } catch (err) {
      onlineCodeJoinError.textContent = err.message;
      onlineCodeJoinError.hidden = false;
    }
  });

  function resetOnlineState() {
    stopOnlineStream();
    onlineRoomToken = null;
    onlineHostToken = null;
    onlinePlayerToken = null;
    onlineIsHost = false;
    onlineLatestSnapshot = null;
    onlineRoleRevealShown = false;
    onlineRoleAcked = false;
    onlineLastNarrated = "";
    onlinePrivateResultPending = false;
    onlineJoinForm.hidden = true;
    onlineCodeJoinForm.hidden = true;
    onlinePlayerListPanel.hidden = true;
    onlineHostPanel.hidden = true;
  }

  /* ---------------- Live-Stream (SSE) ---------------- */
  function stopOnlineStream() {
    if (onlineEventSource) {
      onlineEventSource.close();
      onlineEventSource = null;
    }
    WakeLock.disable();
  }

  function startOnlineStream() {
    stopOnlineStream();
    WakeLock.enable();
    const url = `/api/werwolf/rooms/${onlineRoomToken}/stream?playerToken=${encodeURIComponent(onlinePlayerToken)}`;
    onlineEventSource = new EventSource(url);
    onlineEventSource.addEventListener("state", (event) => {
      onlineLatestSnapshot = JSON.parse(event.data);
      renderOnlineSnapshot(onlineLatestSnapshot);
    });
    onlineEventSource.addEventListener("room-error", (event) => {
      const payload = JSON.parse(event.data);
      Toast.show(payload.message || "Die Runde ist nicht mehr aktiv", "alert-triangle");
      clearSession(onlineRoomToken);
      stopOnlineStream();
      window.location.href = "/";
    });
  }

  /* ---------------- Lobby-Ansicht rendern ---------------- */
  function renderOnlineSnapshot(snapshot) {
    const me = snapshot.players.find((p) => p.isYou);
    if (me && me.left) {
      Toast.show("Du wurdest aus der Runde geworfen", "alert-triangle");
      clearSession(onlineRoomToken);
      stopOnlineStream();
      window.location.href = "/";
      return;
    }

    if (snapshot.phase === "lobby") {
      onlineRoleRevealShown = false;
      onlineRoleAcked = false;
      onlineLastNarrated = "";
      onlinePrivateResultPending = false;
      if (onlineLobbyView.hidden) {
        showOnlineView(onlineLobbyView);
      }
      onlineHostPanel.hidden = !snapshot.isHost;
      onlineJoinForm.hidden = true;
      onlinePlayerListPanel.hidden = false;
      if (snapshot.isHost) {
        renderQrAndLink(onlineRoomToken);
      }
      if (snapshot.isHost && snapshot.shortCode) {
        werwolfShortCodeText.textContent = snapshot.shortCode;
      }
      onlinePlayerCount.textContent = String(snapshot.players.length);
      onlinePlayerList.innerHTML = snapshot.players.map((p) => {
        const kickBtn = (snapshot.isHost && !p.isHost)
          ? `<button type="button" class="m3-icon-button identity-list__kick-button" data-kick-id="${p.playerId}" aria-label="${escapeHtml(p.name)} rauskicken" title="${escapeHtml(p.name)} rauskicken">
               <svg class="m3-icon" style="width:16px; height:16px"><use href="#icon-close"></use></svg>
             </button>`
          : "";
        return `
          <div class="identity-list__item" style="align-items: center;">
            <span class="identity-list__name">${escapeHtml(p.name)}${p.isYou ? " (du)" : ""}${p.isHost ? " · Host" : ""}</span>
            ${kickBtn}
          </div>
        `;
      }).join("");
      onlineWaitingText.hidden = snapshot.isHost;
      onlineLobbyActions.hidden = !snapshot.isHost;
      if (snapshot.isHost) {
        onlineStartButton.disabled = snapshot.players.length < snapshot.minPlayers || snapshot.players.length > snapshot.maxPlayers;
      }
      return;
    }

    // Spiel hat begonnen: erst einmal die eigene Rolle privat per Wisch-Karte
    // zeigen (wie im Einzelgerät-Modus), danach weiter zum gemeinsamen Screen.
    if (!onlineRoleRevealShown) {
      onlineRoleRevealShown = true;
      showOnlineRoleReveal(snapshot);
      return;
    }

    // Solange die Rollen-Enthüllungs-Phase läuft: nach dem eigenen "Weiter"
    // (siehe showOnlineRoleReveal) auf einem gemeinsamen Warte-Screen
    // bleiben, bis WIRKLICH alle bestätigt haben - erst dann schickt der
    // Server die erste Nacht-Phase, und der Screen wechselt automatisch.
    if (snapshot.phase === "reveal") {
      if (onlineRoleAcked) {
        showOnlineView(onlinePlayView);
        onlineEndActions.hidden = true;
        onlineActions.hidden = true;
        onlineBody.innerHTML = "";
        const gate = snapshot.readyGate || { acked: 0, total: 1 };
        onlineStatusText.textContent = `Warte auf die anderen … (${gate.acked}/${gate.total} bereit)`;
      }
      return;
    }

    if (!onlinePlayView.hidden || revealView.hidden) {
      renderOnlinePlay(snapshot);
    }
  }

  function showOnlineRoleReveal(snapshot) {
    showOnlineView(revealView);
    revealStageLabel.textContent = "Deine Rolle";
    revealPlayerName.textContent = "";
    revealProgress.textContent = "";
    revealCard.classList.remove("reveal-card--revealed");
    revealCardBack.hidden = false;
    revealCardFront.hidden = false;
    revealNextButton.hidden = true;
    delete revealCard.dataset.peeked;
    revealCardHint.innerHTML = "Nach oben wischen und halten,<br/>um deine Rolle zu sehen";

    revealRole.textContent = snapshot.myRoleLabel || "";
    revealWord.textContent = ROLE_DESCRIPTIONS[snapshot.myRole] || "";
    revealWord.hidden = false;
    if (snapshot.wolfPack && snapshot.wolfPack.length) {
      revealIdentityList.hidden = false;
      revealIdentityList.innerHTML = `<p class="identity-list__item"><span class="identity-list__name">Eure Mitwölfe:</span></p>` +
        snapshot.wolfPack.map((name) => `<div class="identity-list__item"><span class="identity-list__name">${escapeHtml(name)}</span><span class="identity-list__value">🐺</span></div>`).join("");
    } else {
      revealIdentityList.hidden = true;
    }

    revealNextButton.onclick = async () => {
      if (onlineLatestSnapshot && onlineLatestSnapshot.phase === "reveal") {
        onlineRoleAcked = true;
        showOnlineView(onlinePlayView);
        onlineEndActions.hidden = true;
        onlineActions.hidden = true;
        onlineBody.innerHTML = "";
        onlineStatusText.textContent = "Warte auf die anderen …";
        try {
          await apiPost(`/rooms/${onlineRoomToken}/ack-role`, { playerToken: onlinePlayerToken });
        } catch (err) {
          Toast.show(err.message, "alert-triangle");
        }
      } else {
        // Reconnect-Fall: die Runde ist schon weiter als die Rollen-
        // Enthüllung (z.B. schon mitten in der Nacht) - direkt zum
        // gemeinsamen Screen mit dem aktuellen Stand.
        showOnlineView(onlinePlayView);
        if (onlineLatestSnapshot) renderOnlinePlay(onlineLatestSnapshot);
      }
    };
  }

  function renderOnlinePlay(snapshot) {
    if (snapshot.publicStatus && snapshot.publicStatus !== onlineLastNarrated) {
      onlineLastNarrated = snapshot.publicStatus;
      onlineStatusText.textContent = snapshot.publicStatus;
      const shouldAnnounce = snapshot.announceAllDevices || snapshot.isHost;
      if (shouldAnnounce && !isOnlineMuted()) Sound.say(snapshot.publicStatus);
    }

    if (snapshot.phase === "ended") {
      onlineActions.hidden = true;
      onlineBody.innerHTML = `
        <div class="werwolf-result-card">
          <p class="m3-headline">${snapshot.winner === "dorf" ? "Das Dorf hat gewonnen!" : "Die Werwölfe haben gewonnen!"}</p>
          <div class="identity-list">
            ${snapshot.players.map((p) => `<div class="identity-list__item"><span class="identity-list__name">${escapeHtml(p.name)}</span><span class="identity-list__value">${p.alive ? "" : "☠"}</span></div>`).join("")}
          </div>
        </div>
      `;
      onlineEndActions.hidden = false;
      onlineRestartButton.hidden = !snapshot.isHost;
      if (!snapshot.isHost) {
        onlineBody.innerHTML += `<p class="m3-body" style="text-align: center; margin-top: 8px">Warte, bis der Host eine neue Runde startet …</p>`;
      }
      return;
    }

    onlineEndActions.hidden = true;

    if (onlinePrivateResultPending) return; // Seherin-Ergebnis wird gerade angezeigt, nicht überschreiben

    if (!snapshot.myAlive) {
      onlineBody.innerHTML = `<p class="m3-body" style="text-align: center">Du bist ausgeschieden – schau weiter zu, wie es ausgeht.</p>`;
      onlineActions.hidden = true;
      return;
    }

    if (!snapshot.isMyTurn || !snapshot.myAction) {
      onlineBody.innerHTML = `<p class="m3-body" style="text-align: center">Wartet …</p>`;
      onlineActions.hidden = true;
      return;
    }

    renderOnlineAction(snapshot.myAction);
  }

  // Werwolf-Abstimmung ist anders als die übrigen Nacht-Aktionen: mehrere
  // Personen wählen gemeinsam EIN Ziel, sehen sich dabei gegenseitig live
  // beim Wählen zu (wie am Tisch), und müssen sich erst auf dasselbe Ziel
  // einigen, bevor überhaupt bestätigt werden kann. Deshalb ein eigener
  // Render-Pfad statt der generischen Einzel-Auswahl-Liste.
  function renderWerwolfVoteAction(action) {
    const votesHtml = action.wolfVotes.map((w) => `
      <div class="identity-list__item">
        <span class="identity-list__name">${escapeHtml(w.name)}${w.confirmed ? " ✓" : ""}</span>
        <span class="identity-list__value">${w.votedForName ? escapeHtml(w.votedForName) : "…"}</span>
      </div>
    `).join("");

    const optionsHtml = action.options.map((o) => `
      <button type="button" class="m3-button m3-button--tonal werwolf-choice-list__btn" data-id="${o.playerId}" data-selected="${o.playerId === action.myVote}">${escapeHtml(o.name)}</button>
    `).join("");

    onlineBody.innerHTML = `
      <p class="m3-body" style="text-align: center">Wählt gemeinsam ein Opfer – erst wenn alle dieselbe Person gewählt haben, kann bestätigt werden.</p>
      <div class="identity-list">${votesHtml}</div>
      <div class="werwolf-choice-list">${optionsHtml}</div>
    `;
    onlineBody.onclick = (event) => {
      const btn = event.target.closest("[data-id]");
      if (!btn) return;
      submitWolfVote(btn.dataset.id);
    };

    onlineActions.hidden = false;
    if (action.confirmed) {
      onlineActions.innerHTML = `<p class="m3-body" style="text-align: center">Warte auf die anderen Werwölfe …</p>`;
    } else if (action.canConfirm) {
      onlineActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="online-wolf-confirm-button">Bestätigen</button>`;
      document.getElementById("online-wolf-confirm-button").addEventListener("click", submitWolfConfirm);
    } else {
      onlineActions.innerHTML = `<p class="m3-body" style="text-align: center; color: var(--m3-on-surface-variant)">Noch nicht einig …</p>`;
    }
  }

  async function submitWolfVote(targetId) {
    try {
      // Absichtlich KEIN generisches "Wartet …" danach - die Live-Stimmen-
      // Liste bleibt sichtbar, sie aktualisiert sich über den nächsten
      // SSE-Snapshot von selbst.
      await apiPost(`/rooms/${onlineRoomToken}/action`, { playerToken: onlinePlayerToken, targetPlayerId: targetId });
    } catch (err) {
      Toast.show(err.message, "alert-triangle");
    }
  }

  async function submitWolfConfirm() {
    try {
      await apiPost(`/rooms/${onlineRoomToken}/action`, { playerToken: onlinePlayerToken, action: "confirm" });
    } catch (err) {
      Toast.show(err.message, "alert-triangle");
    }
  }

  function renderOnlineAction(action) {
    if (action.type === "werwolf") {
      renderWerwolfVoteAction(action);
      return;
    }
    if (action.type === "discussion-ready") {
      onlineBody.innerHTML = `<p class="m3-body" style="text-align: center">Wenn ihr fertig diskutiert habt, tippe hier.</p>`;
      onlineActions.hidden = false;
      onlineActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="online-discussion-ready-button">Bereit zur Abstimmung</button>`;
      document.getElementById("online-discussion-ready-button").addEventListener("click", submitDiscussionReady);
      return;
    }
    if (action.type === "hexe-heal") {
      onlineBody.innerHTML = `<p class="m3-body" style="text-align: center">Die Werwölfe haben <strong>${escapeHtml(action.victimName)}</strong> gewählt. Heiltrank einsetzen?</p>`;
      onlineActions.hidden = false;
      onlineActions.innerHTML = `
        <button type="button" class="m3-button m3-button--filled" id="online-heal-yes">Ja, retten</button>
        <button type="button" class="m3-button m3-button--text" id="online-heal-no" style="margin-top: 8px">Nein</button>
      `;
      document.getElementById("online-heal-yes").addEventListener("click", () => submitOnlineAction({ action: "heal-yes" }));
      document.getElementById("online-heal-no").addEventListener("click", () => submitOnlineAction({ action: "heal-no" }));
      return;
    }

    const multiple = !!action.multiple;
    renderOnlineChoiceList(action.options, {
      multiple,
      skipLabel: action.skipLabel || null,
      onConfirm: (idOrIds) => {
        if (action.type === "amor") {
          submitOnlineAction({ targetPlayerIds: idOrIds });
          return;
        }
        if (action.type === "hexe-poison") {
          submitOnlineAction(idOrIds === null ? { action: "poison-skip" } : { action: "poison", targetPlayerId: idOrIds });
          return;
        }
        submitOnlineAction({ targetPlayerId: idOrIds });
      },
    });
  }

  function renderOnlineChoiceList(options, { multiple = false, skipLabel = null, onConfirm }) {
    let selected = [];

    function updateActions() {
      if (!multiple) { onlineActions.hidden = true; onlineActions.innerHTML = ""; return; }
      if (selected.length === 2) {
        onlineActions.hidden = false;
        onlineActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="online-choice-confirm-button">Bestätigen</button>`;
        document.getElementById("online-choice-confirm-button").addEventListener("click", () => onConfirm([...selected]));
      } else {
        onlineActions.hidden = true;
        onlineActions.innerHTML = "";
      }
    }

    function draw() {
      onlineBody.innerHTML = `
        <div class="werwolf-choice-list">
          ${options.map((o) => `
            <button type="button" class="m3-button m3-button--tonal werwolf-choice-list__btn" data-id="${o.playerId}" data-selected="${selected.includes(o.playerId)}">${escapeHtml(o.name)}</button>
          `).join("")}
          ${skipLabel ? `<button type="button" class="m3-button m3-button--text" data-skip="true">${escapeHtml(skipLabel)}</button>` : ""}
        </div>
      `;
    }

    draw();
    updateActions();

    onlineBody.onclick = (event) => {
      const skipBtn = event.target.closest("[data-skip]");
      if (skipBtn) { onConfirm(null); return; }
      const btn = event.target.closest("[data-id]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!multiple) { onConfirm(id); return; }
      if (selected.includes(id)) selected = selected.filter((i) => i !== id);
      else if (selected.length < 2) selected = [...selected, id];
      draw();
      updateActions();
    };
  }

  async function submitOnlineAction(body) {
    try {
      const res = await apiPost(`/rooms/${onlineRoomToken}/action`, { playerToken: onlinePlayerToken, ...body });
      if (res.result && res.result.type === "seherin-result") {
        showOnlinePrivateResult(`${res.result.targetName} ist: ${res.result.targetRole}`);
      } else {
        onlineActions.hidden = true;
        onlineActions.innerHTML = "";
        onlineBody.innerHTML = `<p class="m3-body" style="text-align: center">Wartet …</p>`;
      }
    } catch (err) {
      Toast.show(err.message, "alert-triangle");
    }
  }

  async function submitDiscussionReady() {
    try {
      await apiPost(`/rooms/${onlineRoomToken}/discussion-ready`, { playerToken: onlinePlayerToken });
      onlineActions.hidden = true;
      onlineActions.innerHTML = "";
      onlineBody.innerHTML = `<p class="m3-body" style="text-align: center">Warte auf die anderen …</p>`;
    } catch (err) {
      Toast.show(err.message, "alert-triangle");
    }
  }

  function showOnlinePrivateResult(text) {
    onlinePrivateResultPending = true;
    onlineBody.innerHTML = `
      <div class="werwolf-result-card">
        <p class="m3-headline">${escapeHtml(text)}</p>
      </div>
    `;
    onlineActions.hidden = false;
    onlineActions.innerHTML = `<button type="button" class="m3-button m3-button--filled" id="online-private-result-continue">Weiter</button>`;
    document.getElementById("online-private-result-continue").addEventListener("click", () => {
      onlinePrivateResultPending = false;
      if (onlineLatestSnapshot) renderOnlinePlay(onlineLatestSnapshot);
    });
  }

  onlineStartButton.addEventListener("click", async () => {
    try {
      await apiPost(`/rooms/${onlineRoomToken}/start`, { hostToken: onlineHostToken });
    } catch (err) {
      Toast.show(err.message, "alert-triangle");
    }
  });

  onlinePlayerList.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-kick-id]");
    if (!btn) return;
    const targetPlayerId = btn.dataset.kickId;
    const targetName = onlineLatestSnapshot?.players?.find((p) => p.playerId === targetPlayerId)?.name || "Spieler";
    ConfirmDialog.show({
      title: "Spieler rauskicken?",
      message: `Möchtest du ${targetName} wirklich aus der Runde werfen?`,
      confirmLabel: "Rauswerfen",
      onConfirm: async () => {
        try {
          await apiPost(`/rooms/${onlineRoomToken}/kick`, { hostToken: onlineHostToken, targetPlayerId });
        } catch (err) {
          Toast.show(err.message, "alert-triangle");
        }
      },
    });
  });

  onlineRestartButton.addEventListener("click", async () => {
    if (onlineIsHost) {
      try {
        await apiPost(`/rooms/${onlineRoomToken}/reset`, { hostToken: onlineHostToken });
      } catch (err) {
        Toast.show(err.message, "alert-triangle");
        return;
      }
    }
    onlineRoleRevealShown = false;
    onlineLastNarrated = "";
    showOnlineView(onlineLobbyView);
    onlineHostPanel.hidden = !onlineIsHost;
    onlineJoinForm.hidden = true;
    onlinePlayerListPanel.hidden = false;
    if (onlineIsHost) renderQrAndLink(onlineRoomToken);
  });
  onlineExitButton.addEventListener("click", () => {
    leaveOrEndOnlineRoom();
    stopOnlineStream();
    window.location.href = "/";
  });

  // Verlässt der Host die Runde (egal ob mitten im Spiel oder von der
  // Ergebnis-Ansicht aus), wird sie für alle beendet - ohne Host kann
  // niemand mehr Phasen weiterschieben oder neu starten, die Runde würde
  // sonst nur verwaist im Speicher hängen bleiben (bis zum TTL-Ablauf).
  // Verlässt eine NICHT-Host-Person, wird sie serverseitig als "left"
  // markiert, damit die Gruppe nie auf ihre Bestätigung/Stimme wartet, die
  // nie mehr kommt (siehe leave_room in werwolf_backend.py).
  function leaveOrEndOnlineRoom() {
    if (!onlineRoomToken) return;
    if (onlineIsHost) {
      if (!onlineHostToken) return;
      apiPost(`/rooms/${onlineRoomToken}/end`, { hostToken: onlineHostToken }).catch(() => {});
    } else if (onlinePlayerToken) {
      apiPost(`/rooms/${onlineRoomToken}/leave`, { playerToken: onlinePlayerToken }).catch(() => {});
      clearSession(onlineRoomToken);
    }
  }

  /* ---------------- Beim Laden: Join-Link erkennen ---------------- */
  const joinTokenFromUrl = detectJoinToken();
  if (joinTokenFromUrl) {
    enterAsJoiner(joinTokenFromUrl);
  }
})();
