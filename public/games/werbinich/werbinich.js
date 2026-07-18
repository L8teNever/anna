/**
 * Wer bin ich – jede Person bekommt eine geheime Identität, sieht aber beim
 * Reihum-Wischen NICHT die eigene, sondern die aller anderen (wie der
 * klassische Zettel auf der Stirn). Zusätzlich gibt es während der
 * laufenden Runde ein "Nachschlagen": falls jemand vergessen hat, was eine
 * andere Person ist, kann man (nach Auswahl der eigenen Person, damit man
 * nicht versehentlich die eigene Identität sieht) die Liste erneut ansehen.
 */
(function () {
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 12;

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                        */
  /* ------------------------------------------------------------------ */
  const setupView = document.getElementById("setup-view");
  const categorySelectView = document.getElementById("view-category-select");
  const playerSelectView = document.getElementById("view-player-select");
  const revealView = document.getElementById("view-reveal");
  const playView = document.getElementById("play-view");
  const lookupView = document.getElementById("view-lookup");
  const backButton = document.getElementById("back-button");

  const startButton = document.getElementById("start-button");

  const openCategorySelectBtn = document.getElementById("open-category-select-button");
  const categoryBackButton = document.getElementById("category-select-back-button");
  const categoryConfirmButton = document.getElementById("category-select-confirm-button");

  const playerSummary = document.getElementById("player-select-summary");
  const openPlayerSelectBtn = document.getElementById("open-player-select-button");
  const playerBackButton = document.getElementById("player-select-back-button");
  const playerConfirmButton = document.getElementById("player-select-confirm-button");

  const validationWarning = document.getElementById("validation-warning");
  const validationWarningText = document.getElementById("validation-warning-text");

  const revealPlayerName = document.getElementById("reveal-player-name");
  const revealProgress = document.getElementById("reveal-progress");
  const revealCard = document.getElementById("reveal-card");
  const revealCardFront = document.getElementById("reveal-card-front");
  const revealCardBack = document.getElementById("reveal-card-back");
  const revealIdentityList = document.getElementById("reveal-identity-list");
  const revealNextButton = document.getElementById("reveal-next-button");

  const restartButton = document.getElementById("restart-button");
  const exitButton = document.getElementById("exit-button");

  const openLookupButton = document.getElementById("open-lookup-button");
  const lookupSelectStage = document.getElementById("lookup-select-stage");
  const lookupResultStage = document.getElementById("lookup-result-stage");
  const lookupPlayerList = document.getElementById("lookup-player-list");
  const lookupIdentityList = document.getElementById("lookup-identity-list");
  const lookupChangePlayerButton = document.getElementById("lookup-change-player-button");
  const lookupCloseButton = document.getElementById("lookup-close-button");

  const playerPicker = PlayerPicker.create();
  const categoryPicker = CategoryPicker.create("werbinich", "/games/werbinich/categories.json");

  /* ------------------------------------------------------------------ */
  /* Ansichten wechseln                                                    */
  /* ------------------------------------------------------------------ */
  openCategorySelectBtn.addEventListener("click", () => ViewNav.transition(setupView, categorySelectView));
  categoryBackButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));
  categoryConfirmButton.addEventListener("click", () => ViewNav.transition(categorySelectView, setupView));

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
  }

  playerPicker.onChange(() => updatePlayerSummary());
  updatePlayerSummary();

  openPlayerSelectBtn.addEventListener("click", () => ViewNav.transition(setupView, playerSelectView));
  playerBackButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));
  playerConfirmButton.addEventListener("click", () => ViewNav.transition(playerSelectView, setupView));

  /* ------------------------------------------------------------------ */
  /* Wisch-nach-oben-Karte (identisch zu Impostor, nur Inhalt anders)      */
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
  /* Identitäten-Zuteilung                                                 */
  /* ------------------------------------------------------------------ */
  let roundPlayers = [];
  let roundIdentities = []; // parallel zu roundPlayers: { text, icon }

  let revealAvatars = [
    "/assets/reveal_images/avatar_1.png",
    "/assets/reveal_images/avatar_2.png",
    "/assets/reveal_images/avatar_3.png",
    "/assets/reveal_images/avatar_4.png"
  ];
  let playerRevealAvatars = {};
  let avatarSeedOffset = 0;

  async function loadRevealAvatars() {
    try {
      const res = await fetch("/api/reveal-avatars");
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          revealAvatars = list;
        }
      }
    } catch (e) {
      console.warn("Could not load custom reveal avatars, using defaults:", e);
    }
  }
  loadRevealAvatars();

  function getPlayerRevealAvatar(name) {
    if (!name) {
      return revealAvatars[Math.floor(Math.random() * revealAvatars.length)];
    }
    if (!playerRevealAvatars[name]) {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash + avatarSeedOffset) % revealAvatars.length;
      playerRevealAvatars[name] = revealAvatars[index];
    }
    return playerRevealAvatars[name];
  }

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Eindeutige (nicht wiederholte) Identität pro Mitspieler ziehen, damit
  // niemand versehentlich dieselbe Identität wie jemand anderes bekommt.
  function pickIdentities(playerCount) {
    const pool = [];
    categoryPicker.getSelectedCategories().forEach((cat) => {
      if (!Array.isArray(cat.words)) return;
      cat.words.forEach((text) => pool.push({ text, icon: cat.icon }));
    });
    if (pool.length < playerCount) return null;
    return shuffle(pool).slice(0, playerCount);
  }

  /* ------------------------------------------------------------------ */
  /* Gemeinsame Liste "Die anderen sind" (Wischen UND Nachschlagen)        */
  /* ------------------------------------------------------------------ */
  function renderIdentityList(containerEl, excludeIndex) {
    containerEl.innerHTML = roundPlayers
      .map((name, idx) => {
        if (idx === excludeIndex) return "";
        const identity = roundIdentities[idx];
        const icon = identity && identity.icon ? `${identity.icon} ` : "";
        const text = identity ? identity.text : "…";
        return `
          <div class="identity-list__item">
            <span class="identity-list__name">${escapeHtml(name)}</span>
            <span class="identity-list__value">${icon}${escapeHtml(text)}</span>
          </div>
        `;
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Ablauf: Reihum wischen                                         */
  /* ------------------------------------------------------------------ */
  let currentRevealIndex = 0;

  function showRevealForCurrentPlayer() {
    revealPlayerName.textContent = roundPlayers[currentRevealIndex];
    revealProgress.textContent = `${currentRevealIndex + 1} / ${roundPlayers.length}`;
    revealCard.classList.remove("reveal-card--revealed");

    const imgEl = document.getElementById("reveal-card-image");
    if (imgEl) {
      imgEl.src = getPlayerRevealAvatar(roundPlayers[currentRevealIndex]);
    }

    renderIdentityList(revealIdentityList, currentRevealIndex);

    revealCardBack.hidden = false;
    revealCardFront.hidden = false;
    revealNextButton.hidden = true;
    delete revealCard.dataset.peeked;
    const hint = document.getElementById("reveal-card-hint");
    if (hint) hint.innerHTML = "Nach oben wischen und halten,<br/>um zu sehen, wer die anderen sind";
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
      const hint = document.getElementById("reveal-card-hint");
      if (hint) hint.innerHTML = "Erneut ansehen<br/>(Wischen & Halten)";
    }
  }

  setupSwipeReveal(revealCard, revealCardFront, peekCurrentPlayer, hideCurrentPlayer);

  revealNextButton.addEventListener("click", () => {
    currentRevealIndex += 1;
    if (currentRevealIndex < roundPlayers.length) {
      showRevealForCurrentPlayer();
    } else {
      ViewNav.transition(revealView, playView);
    }
  });

  function beginRound() {
    const activePlayers = playerPicker.getSelectedNames();
    const identities = pickIdentities(activePlayers.length);
    if (!identities) {
      Toast.show("Nicht genügend Begriffe in den gewählten Kategorien – bitte mehr Kategorien aktivieren", "alert-triangle");
      return;
    }

    roundPlayers = shuffle(activePlayers);
    roundIdentities = identities;
    playerRevealAvatars = {};
    avatarSeedOffset = Math.floor(Math.random() * revealAvatars.length);

    currentRevealIndex = 0;
    ViewNav.transition(null, revealView);
    showRevealForCurrentPlayer();
  }

  startButton.addEventListener("click", () => {
    const count = playerPicker.getActiveCount();
    if (count < MIN_PLAYERS || count > MAX_PLAYERS) return;
    beginRound();
  });

  restartButton.addEventListener("click", beginRound);
  exitButton.addEventListener("click", () => { ViewNav.transition(playView, setupView); });

  /* ------------------------------------------------------------------ */
  /* Nachschlagen (während der laufenden Runde)                           */
  /* ------------------------------------------------------------------ */
  function showLookupSelectStage() {
    lookupSelectStage.hidden = false;
    lookupResultStage.hidden = true;
    lookupPlayerList.innerHTML = roundPlayers
      .map((name, idx) => `
        <button type="button" class="m3-button m3-button--tonal" data-lookup-index="${idx}">${escapeHtml(name)}</button>
      `)
      .join("");
  }

  lookupPlayerList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-lookup-index]");
    if (!btn) return;
    const idx = Number(btn.dataset.lookupIndex);
    renderIdentityList(lookupIdentityList, idx);
    lookupSelectStage.hidden = true;
    lookupResultStage.hidden = false;
  });

  lookupChangePlayerButton.addEventListener("click", showLookupSelectStage);

  openLookupButton.addEventListener("click", () => {
    showLookupSelectStage();
    ViewNav.transition(playView, lookupView);
  });

  lookupCloseButton.addEventListener("click", () => ViewNav.transition(lookupView, playView));

  /* ------------------------------------------------------------------ */
  /* Zurück-Navigation                                                     */
  /* ------------------------------------------------------------------ */
  backButton.addEventListener("click", () => {
    if (!lookupView.hidden && setupView.hidden) {
      ViewNav.transition(lookupView, playView);
      return;
    }
    if (!revealView.hidden && setupView.hidden) {
      // Identitäten-Weitergabe läuft gerade -> erst bestätigen lassen.
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die Identitäten-Weitergabe wird abgebrochen.",
        confirmLabel: "Verlassen",
        onConfirm: () => ViewNav.transition(revealView, setupView),
      });
      return;
    }
    if (!playView.hidden && setupView.hidden) {
      // Rateunde läuft -> erst bestätigen lassen.
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
    window.location.href = "/";
  });

  // Bestätigung beim System-Zurück (Android/iOS-Zurück-Geste, siehe
  // view-nav.js) – die lässt sich nur synchron per window.confirm()
  // abfangen, ein eigenes Dialogfenster kann die Browser-Navigation nicht
  // rechtzeitig aufhalten. Das Nachschlagen selbst braucht keine Bestätigung
  // (es geht nichts verloren), nur Weitergabe/Ratephase.
  window.confirmGameExit = function () {
    const currentActive = document.querySelector(".app-view:not([hidden])");
    if (currentActive && (currentActive.id === "view-reveal" || currentActive.id === "play-view")) {
      return confirm("Möchtest du das laufende Spiel wirklich beenden?");
    }
    return true;
  };
})();
