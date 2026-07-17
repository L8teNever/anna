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

  const playerPicker = PlayerPicker.create();

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
    validationWarning.hidden = valid;
    if (!valid) {
      validationWarningText.textContent = count < MIN_PLAYERS
        ? `Mindestens ${MIN_PLAYERS} Mitspieler nötig (aktuell ${count}).`
        : `Höchstens ${MAX_PLAYERS} Mitspieler möglich (aktuell ${count}).`;
    }
    startButton.disabled = !valid;
    renderWerwolfCount();
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

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
    if (currentActive && (currentActive.id === "view-reveal" || currentActive.id === "play-view")) {
      return confirm("Möchtest du das laufende Spiel wirklich beenden?");
    }
    return true;
  };
})();
