/**
 * Feedback-Popups (Bug melden / Neues Wort vorschlagen / Wort-Feedback /
 * Spiel-Feedback / Spielewunsch) - baut vorausgefüllte GitHub-Issue-Links
 * über github-feedback.js. Erscheinen als ein einziges, modulares und
 * selbsterklärendes Schritt-für-Schritt-Modal direkt an Ort und Stelle.
 * Spiele/Kategorien/Wörter werden datengetrieben geladen. Baut nur dann etwas
 * auf, wenn der Feedback-Button auf der aktuellen Seite existiert.
 */
(function () {
  const unifiedButton = document.getElementById("feedback-unified-button");

  if (!unifiedButton) return;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  // Nur Spiele mit eigener categories.json unterstützen Wort-Feedback
  function gamesWithCategories() {
    return window.GAMES.filter(
      (g) => Array.isArray(g.assets) && g.assets.some((a) => a.endsWith("/categories.json"))
    ).map((g) => ({ value: g.id, label: g.name }));
  }

  function categoriesUrlFor(gameId) {
    const game = window.GAMES.find((g) => g.id === gameId);
    return game ? game.assets.find((a) => a.endsWith("/categories.json")) : null;
  }

  function normalizeWordEntry(entry) {
    return typeof entry === "string" ? { word: entry } : { word: entry.word };
  }

  async function fetchCategories(gameId) {
    const url = categoriesUrlFor(gameId);
    if (!url) return [];
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  function allGamesOptions() {
    return [
      { value: "general", label: "📱 App allgemein / System" }
    ].concat(
      window.GAMES.map((g) => ({ value: g.id, label: g.name }))
    );
  }

  const WIZARD_FLOWS = {
    bug: ["type", "bug-game", "bug-cat", "bug-text"],
    "word-feedback": ["type", "wfeed-game", "wfeed-cat", "wfeed-word", "wfeed-reason"],
    "word-suggestion": ["type", "wsug-game", "wsug-cat", "wsug-text"],
    "game-feedback": ["type", "gfeed-game", "gfeed-text"],
    "game-request": ["type", "greq-text"]
  };

  const BUG_CATEGORIES = [
    { value: "ui", label: "Darstellung / UI" },
    { value: "gameplay", label: "Spiellogik" },
    { value: "performance", label: "Absturz / Performance" },
    { value: "other", label: "Sonstiges" },
  ];

  function setupUnifiedWizard(modalElement, typeSelect, onValidateStep, onSubmit) {
    let currentFlowIndex = 0;

    function getActiveFlow() {
      const type = typeSelect.getValue() || "bug";
      return WIZARD_FLOWS[type] || WIZARD_FLOWS.bug;
    }

    const steps = modalElement.querySelectorAll("[data-step]");
    const backBtn = modalElement.querySelector("[data-wizard-back]");
    const nextBtn = modalElement.querySelector("[data-wizard-next]");

    function updateUI() {
      const activeFlow = getActiveFlow();
      const currentStepName = activeFlow[currentFlowIndex];

      steps.forEach((step) => {
        const stepName = step.getAttribute("data-step");
        step.hidden = stepName !== currentStepName;
      });

      backBtn.style.display = currentFlowIndex === 0 ? "none" : "block";
      if (currentFlowIndex === activeFlow.length - 1) {
        nextBtn.textContent = "Auf GitHub öffnen";
      } else {
        nextBtn.textContent = "Weiter";
      }

      validate();
    }

    function validate() {
      const activeFlow = getActiveFlow();
      const currentStepName = activeFlow[currentFlowIndex];
      const isValid = onValidateStep(currentStepName);
      nextBtn.disabled = !isValid;
    }

    backBtn.addEventListener("click", () => {
      if (currentFlowIndex > 0) {
        CustomSelect.closeAll();
        currentFlowIndex--;
        updateUI();
      }
    });

    nextBtn.addEventListener("click", () => {
      const activeFlow = getActiveFlow();
      if (currentFlowIndex < activeFlow.length - 1) {
        CustomSelect.closeAll();
        currentFlowIndex++;
        updateUI();
      } else {
        onSubmit(typeSelect.getValue());
      }
    });

    return {
      updateUI,
      validate,
      reset: () => {
        currentFlowIndex = 0;
        updateUI();
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Modal-Grundgerüst                                                  */
  /* ------------------------------------------------------------------ */
  function buildModal(id, titleIcon, titleColor, titleText, bodyHtml) {
    const modal = document.createElement("div");
    modal.id = id;
    modal.className = "m3-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="m3-modal__backdrop" data-fb-backdrop></div>
      <div class="m3-modal__dialog" style="max-width: 400px">
        <div class="m3-modal__header">
          <h3 class="m3-modal__title">
            <svg class="m3-icon" style="width: 18px; height: 18px; color: ${titleColor}"><use href="#${titleIcon}"></use></svg>
            ${titleText}
          </h3>
          <button type="button" class="m3-icon-button" data-fb-close aria-label="Schließen">
            <svg class="m3-icon"><use href="#icon-close"></use></svg>
          </button>
        </div>
        ${bodyHtml}
      </div>
    `;
    document.body.appendChild(modal);

    function close() {
      modal.hidden = true;
      CustomSelect.closeAll();
    }

    modal.querySelector("[data-fb-close]").addEventListener("click", close);
    modal.querySelector("[data-fb-backdrop]").addEventListener("click", close);

    function open() {
      modal.hidden = false;
      if (modal.wizard) modal.wizard.reset();
    }

    return { modal, open, close };
  }

  /* ------------------------------------------------------------------ */
  /* Unified Modal                                                     */
  /* ------------------------------------------------------------------ */
  let unifiedModal = null;

  function ensureUnifiedModal() {
    if (unifiedModal) return unifiedModal;

    const bodyHtml = `
      <div class="m3-modal__wizard-steps">
        <!-- Step 1: Typ auswählen -->
        <div data-step="type" class="m3-modal__step">
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 1</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Was möchtest du tun?</label>
            <div id="feedback-unified-type-select"></div>
          </div>
        </div>

        <!-- BUG STEPS -->
        <div data-step="bug-game" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Bug melden – Schritt 2 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Welches Spiel betrifft es?</label>
            <div id="feedback-bug-game-select"></div>
          </div>
        </div>
        <div data-step="bug-cat" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Bug melden – Schritt 3 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Worum geht's ungefähr?</label>
            <div id="feedback-bug-category-select"></div>
          </div>
        </div>
        <div data-step="bug-text" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Bug melden – Schritt 4 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Was ist passiert?</label>
            <textarea class="m3-textarea" id="feedback-bug-textarea" placeholder="Beschreibe den Fehler und wie wir ihn nachstellen können..."></textarea>
          </div>
        </div>

        <!-- WORD FEEDBACK STEPS -->
        <div data-step="wfeed-game" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Wort-Feedback – Schritt 2 von 5</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Aus welchem Spiel?</label>
            <div id="feedback-report-game-select"></div>
          </div>
        </div>
        <div data-step="wfeed-cat" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Wort-Feedback – Schritt 3 von 5</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Aus welcher Kategorie?</label>
            <div id="feedback-report-category-select"></div>
          </div>
        </div>
        <div data-step="wfeed-word" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Wort-Feedback – Schritt 4 von 5</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Welches Wort / welche Frage?</label>
            <div id="feedback-report-word-select"></div>
          </div>
        </div>
        <div data-step="wfeed-reason" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Wort-Feedback – Schritt 5 von 5</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Warum? (optional)</label>
            <textarea class="m3-textarea" id="feedback-report-reason-input" placeholder="Was stimmt damit nicht?"></textarea>
          </div>
        </div>

        <!-- WORD SUGGESTION STEPS -->
        <div data-step="wsug-game" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Wortvorschlag – Schritt 2 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Für welches Spiel?</label>
            <div id="feedback-suggest-game-select"></div>
          </div>
        </div>
        <div data-step="wsug-cat" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Wortvorschlag – Schritt 3 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">In welcher Kategorie?</label>
            <div id="feedback-suggest-category-select"></div>
          </div>
        </div>
        <div data-step="wsug-text" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Wortvorschlag – Schritt 4 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Dein Vorschlag</label>
            <textarea class="m3-textarea" id="feedback-suggest-text-input" placeholder="z. B. neues Wort, neue Frage oder neuer Prompt…"></textarea>
          </div>
        </div>

        <!-- GAME FEEDBACK STEPS -->
        <div data-step="gfeed-game" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Spiel-Feedback – Schritt 2 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Welches Spiel betrifft es?</label>
            <div id="feedback-gfeed-game-select"></div>
          </div>
        </div>
        <div data-step="gfeed-text" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Spiel-Feedback – Schritt 3 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Dein Feedback</label>
            <textarea class="m3-textarea" id="feedback-gfeed-textarea" placeholder="Was gefällt dir an dem Spiel, was können wir verbessern?"></textarea>
          </div>
        </div>

        <!-- GAME REQUEST STEPS -->
        <div data-step="greq-text" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Spielewunsch – Schritt 2 von 2</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Welches Spiel oder welche Idee wünschst du dir?</label>
            <textarea class="m3-textarea" id="feedback-greq-textarea" placeholder="Name des Spiels, Regeln oder wie es ablaufen soll..."></textarea>
          </div>
        </div>
      </div>

      <div class="m3-modal__actions" style="margin-top: 8px">
        <button type="button" class="m3-button m3-button--text" data-wizard-back style="margin-right: auto;">Zurück</button>
        <button type="button" class="m3-button m3-button--filled" data-wizard-next>Weiter</button>
      </div>
    `;

    unifiedModal = buildModal(
      "feedback-unified-modal",
      "icon-chat",
      "var(--m3-primary)",
      "Feedback & Ideen",
      bodyHtml
    );

    const bugTextarea = document.getElementById("feedback-bug-textarea");
    const suggestTextInput = document.getElementById("feedback-suggest-text-input");
    const reportReasonInput = document.getElementById("feedback-report-reason-input");
    const gfeedTextarea = document.getElementById("feedback-gfeed-textarea");
    const greqTextarea = document.getElementById("feedback-greq-textarea");

    let reportCategoriesList = [];
    let suggestCategoriesList = [];

    const typeSelect = CustomSelect.create(document.getElementById("feedback-unified-type-select"), {
      options: [
        { value: "bug", label: "🐛 Bug melden (Fehler im Spiel)" },
        { value: "word-feedback", label: "👎 Wort-Feedback (Wort gefällt mir nicht)" },
        { value: "word-suggestion", label: "✨ Neues Wort vorschlagen" },
        { value: "game-feedback", label: "🎮 Feedback zu einem Spiel" },
        { value: "game-request", label: "💡 Neues Spiel wünschen" }
      ],
      value: "bug",
      onChange: () => wizard && wizard.validate()
    });

    const bugGameSelect = CustomSelect.create(document.getElementById("feedback-bug-game-select"), {
      options: allGamesOptions(),
      value: "general",
      onChange: () => wizard && wizard.validate()
    });

    const bugCategorySelect = CustomSelect.create(document.getElementById("feedback-bug-category-select"), {
      options: BUG_CATEGORIES,
      value: "ui",
      onChange: () => wizard && wizard.validate()
    });

    const reportWordSelect = CustomSelect.create(document.getElementById("feedback-report-word-select"), {
      placeholder: "Erst Kategorie wählen…",
      onChange: () => wizard && wizard.validate()
    });

    function loadReportWords() {
      const catId = reportCategorySelect.getValue();
      const cat = reportCategoriesList.find((c) => c.id === catId);
      const words = cat && Array.isArray(cat.words) ? cat.words.map(normalizeWordEntry) : [];
      reportWordSelect.setOptions(words.map((w) => ({ value: w.word, label: w.word })));
      if (wizard) wizard.validate();
    }

    const reportCategorySelect = CustomSelect.create(document.getElementById("feedback-report-category-select"), {
      placeholder: "Kategorien werden geladen…",
      onChange: () => {
        loadReportWords();
        if (wizard) wizard.validate();
      }
    });

    async function loadReportCategories(gameId) {
      reportCategorySelect.setOptions([], "");
      reportWordSelect.setOptions([]);
      if (wizard) wizard.validate();
      reportCategoriesList = await fetchCategories(gameId);
      reportCategorySelect.setOptions(reportCategoriesList.map((c) => ({ value: c.id, label: `${c.icon || ""} ${c.label}`.trim() })));
      loadReportWords();
      if (wizard) wizard.validate();
    }

    const reportGameSelect = CustomSelect.create(document.getElementById("feedback-report-game-select"), {
      options: gamesWithCategories(),
      onChange: (gameId) => {
        loadReportCategories(gameId);
        if (wizard) wizard.validate();
      }
    });

    const suggestCategorySelect = CustomSelect.create(document.getElementById("feedback-suggest-category-select"), {
      placeholder: "Kategorien werden geladen…",
      onChange: () => wizard && wizard.validate()
    });

    async function loadSuggestCategories(gameId) {
      suggestCategorySelect.setOptions([{ value: "", label: "Kategorien werden geladen…" }], "");
      if (wizard) wizard.validate();
      suggestCategoriesList = await fetchCategories(gameId);
      const options = suggestCategoriesList
        .map((c) => ({ value: c.id, label: `${c.icon || ""} ${c.label}`.trim() }))
        .concat([{ value: "__new__", label: "✨ Neue Kategorie vorschlagen" }]);
      suggestCategorySelect.setOptions(options);
      if (wizard) wizard.validate();
    }

    const suggestGameSelect = CustomSelect.create(document.getElementById("feedback-suggest-game-select"), {
      options: gamesWithCategories(),
      onChange: (gameId) => {
        loadSuggestCategories(gameId);
        if (wizard) wizard.validate();
      }
    });

    const gfeedGameSelect = CustomSelect.create(document.getElementById("feedback-gfeed-game-select"), {
      options: allGamesOptions(),
      value: "general",
      onChange: () => wizard && wizard.validate()
    });

    const wizard = setupUnifiedWizard(
      unifiedModal.modal,
      typeSelect,
      (stepName) => {
        if (stepName === "type") return !!typeSelect.getValue();
        if (stepName === "bug-game") return !!bugGameSelect.getValue();
        if (stepName === "bug-cat") return !!bugCategorySelect.getValue();
        if (stepName === "bug-text") return !!bugTextarea.value.trim();
        if (stepName === "wfeed-game") return !!reportGameSelect.getValue();
        if (stepName === "wfeed-cat") return !!reportCategorySelect.getValue();
        if (stepName === "wfeed-word") return !!reportWordSelect.getValue();
        if (stepName === "wfeed-reason") return true;
        if (stepName === "wsug-game") return !!suggestGameSelect.getValue();
        if (stepName === "wsug-cat") return !!suggestCategorySelect.getValue();
        if (stepName === "wsug-text") return !!suggestTextInput.value.trim();
        if (stepName === "gfeed-game") return !!gfeedGameSelect.getValue();
        if (stepName === "gfeed-text") return !!gfeedTextarea.value.trim();
        if (stepName === "greq-text") return !!greqTextarea.value.trim();
        return true;
      },
      (type) => {
        if (type === "bug") {
          const gameId = bugGameSelect.getValue();
          const game = window.GAMES.find((g) => g.id === gameId);
          const catValue = bugCategorySelect.getValue();
          const catLabel = (BUG_CATEGORIES.find((c) => c.value === catValue) || {}).label || catValue;
          const text = bugTextarea.value.trim();
          const labels = ["bug", catValue];
          if (gameId && gameId !== "general") labels.push(`game:${gameId}`);

          GithubFeedback.openIssue({
            title: `Bugreport: ${game ? game.name : "App allgemein"}`,
            body: `**Bereich:** ${catLabel}\n**Spiel/Kontext:** ${game ? game.name : "Allgemein / System"}\n\n**Beschreibung**\n${text}\n`,
            labels: labels
          });
        } else if (type === "word-feedback") {
          const gameId = reportGameSelect.getValue();
          const game = window.GAMES.find((g) => g.id === gameId);
          const word = reportWordSelect.getValue();
          if (!game || !word) return;
          const catId = reportCategorySelect.getValue();
          const cat = reportCategoriesList.find((c) => c.id === catId);
          const reason = reportReasonInput.value.trim();

          GithubFeedback.openIssue({
            title: `Wort-Feedback: ${game.name} – ${word}`,
            body: `**Spiel:** ${game.name}\n**Kategorie:** ${cat ? cat.label : catId}\n**Wort/Frage:** ${word}\n\n**Warum?**\n${reason || "(kein Grund angegeben)"}`,
            labels: ["word-feedback", `game:${game.id}`, "dislike"]
          });
        } else if (type === "word-suggestion") {
          const gameId = suggestGameSelect.getValue();
          const game = window.GAMES.find((g) => g.id === gameId);
          const text = suggestTextInput.value.trim();
          if (!game || !text) return;
          const catId = suggestCategorySelect.getValue();
          const cat = suggestCategoriesList.find((c) => c.id === catId);
          const catLabel = catId === "__new__" ? "Neue Kategorie" : cat ? cat.label : catId;

          GithubFeedback.openIssue({
            title: `Wortvorschlag: ${game.name}`,
            body: `**Spiel:** ${game.name}\n**Kategorie:** ${catLabel}\n\n**Vorschlag**\n${text}`,
            labels: ["word-suggestion", `game:${game.id}`]
          });
        } else if (type === "game-feedback") {
          const gameId = gfeedGameSelect.getValue();
          const game = window.GAMES.find((g) => g.id === gameId);
          const text = gfeedTextarea.value.trim();
          const labels = ["game-feedback"];
          if (gameId && gameId !== "general") labels.push(`game:${gameId}`);

          GithubFeedback.openIssue({
            title: `Spiel-Feedback: ${game ? game.name : "App allgemein"}`,
            body: `**Spiel:** ${game ? game.name : "Allgemein"}\n\n**Feedback**\n${text}`,
            labels: labels
          });
        } else if (type === "game-request") {
          const text = greqTextarea.value.trim();

          GithubFeedback.openIssue({
            title: `Neues Spiel gewünscht`,
            body: `**Beschreibung der Spielidee**\n${text}`,
            labels: ["game-request"]
          });
        }
        unifiedModal.close();
      }
    );

    bugTextarea.addEventListener("input", () => wizard.validate());
    suggestTextInput.addEventListener("input", () => wizard.validate());
    gfeedTextarea.addEventListener("input", () => wizard.validate());
    greqTextarea.addEventListener("input", () => wizard.validate());

    const firstCatGame = gamesWithCategories()[0];
    if (firstCatGame) {
      reportGameSelect.setValue(firstCatGame.value);
      loadReportCategories(firstCatGame.value);
      suggestGameSelect.setValue(firstCatGame.value);
      loadSuggestCategories(firstCatGame.value);
    }

    unifiedModal.modal.wizard = wizard;
    return unifiedModal;
  }

  /* ------------------------------------------------------------------ */
  /* Auslöser                                                           */
  /* ------------------------------------------------------------------ */
  if (unifiedButton) {
    unifiedButton.addEventListener("click", () => {
      ensureUnifiedModal().open();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (unifiedModal && !unifiedModal.modal.hidden) {
      unifiedModal.close();
    }
  });
})();
