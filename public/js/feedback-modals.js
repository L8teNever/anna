/**
 * Feedback-Popups (Bug melden / Neues Wort vorschlagen / Wort melden) - baut
 * vorausgefüllte GitHub-Issue-Links über github-feedback.js. Erscheinen als
 * Modal direkt an Ort und Stelle (z.B. in den Einstellungen) statt als
 * eigene Unterseite. Spiele/Kategorien/Wörter werden datengetrieben aus
 * game-registry.js + der jeweiligen categories.json geladen - kein
 * hartcodierter Spiele-Katalog hier. Baut nur dann etwas auf, wenn die
 * passenden Auslöser-Buttons auf der aktuellen Seite existieren.
 */
(function () {
  const bugButton = document.getElementById("feedback-bug-button");
  const suggestButton = document.getElementById("feedback-suggest-button");
  const reportButton = document.getElementById("feedback-report-button");

  if (!bugButton && !suggestButton && !reportButton) return;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  // Nur Spiele mit eigener categories.json unterstützen Wort-Feedback
  // (Werwolf hat feste Rollen statt Wörtern, Perfekte Form hat keine
  // Wortliste) - Erkennung rein über die assets-Liste in game-registry.js.
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

  function bugGamesOptions() {
    return [
      { value: "general", label: "📱 App allgemein / Sonstiges" }
    ].concat(
      window.GAMES.map((g) => ({ value: g.id, label: g.name }))
    );
  }

  function setupWizard(modalElement, totalSteps, onValidateStep, onSubmit) {
    let currentStep = 0;
    const steps = modalElement.querySelectorAll("[data-step]");
    const backBtn = modalElement.querySelector("[data-wizard-back]");
    const nextBtn = modalElement.querySelector("[data-wizard-next]");

    function updateUI() {
      steps.forEach((step, idx) => {
        step.hidden = idx !== currentStep;
      });

      backBtn.style.display = currentStep === 0 ? "none" : "block";
      if (currentStep === totalSteps - 1) {
        nextBtn.textContent = "Auf GitHub öffnen";
        nextBtn.className = "m3-button m3-button--filled";
      } else {
        nextBtn.textContent = "Weiter";
        nextBtn.className = "m3-button m3-button--filled";
      }

      validate();
    }

    function validate() {
      const isValid = onValidateStep(currentStep);
      nextBtn.disabled = !isValid;
    }

    backBtn.addEventListener("click", () => {
      if (currentStep > 0) {
        CustomSelect.closeAll();
        currentStep--;
        updateUI();
      }
    });

    nextBtn.addEventListener("click", () => {
      if (currentStep < totalSteps - 1) {
        CustomSelect.closeAll();
        currentStep++;
        updateUI();
      } else {
        onSubmit();
      }
    });

    updateUI();

    return {
      updateUI,
      validate,
      reset: () => {
        currentStep = 0;
        updateUI();
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Modal-Grundgerüst                                                    */
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
  /* Bug melden                                                           */
  /* ------------------------------------------------------------------ */
  const BUG_CATEGORIES = [
    { value: "ui", label: "Darstellung / UI" },
    { value: "gameplay", label: "Spiellogik" },
    { value: "performance", label: "Absturz / Performance" },
    { value: "other", label: "Sonstiges" },
  ];

  let bugModal = null;

  function ensureBugModal() {
    if (bugModal) return bugModal;
    
    const bodyHtml = `
      <div class="m3-modal__wizard-steps">
        <!-- Step 1: Spiel -->
        <div data-step="0" class="m3-modal__step">
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 1 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Welches Spiel betrifft es?</label>
            <div id="feedback-bug-game-select"></div>
          </div>
        </div>
        
        <!-- Step 2: Bereich -->
        <div data-step="1" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 2 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Worum geht's ungefähr?</label>
            <div id="feedback-bug-category-select"></div>
          </div>
        </div>
        
        <!-- Step 3: Beschreibung -->
        <div data-step="2" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 3 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Was ist passiert?</label>
            <textarea class="m3-textarea" id="feedback-bug-textarea" placeholder="Beschreibe den Fehler und wie wir ihn nachstellen können..."></textarea>
          </div>
        </div>
      </div>
      
      <div class="m3-modal__actions" style="margin-top: 8px">
        <button type="button" class="m3-button m3-button--text" data-wizard-back style="margin-right: auto;">Zurück</button>
        <button type="button" class="m3-button m3-button--filled" data-wizard-next>Weiter</button>
      </div>
    `;

    bugModal = buildModal(
      "feedback-bug-modal",
      "icon-alert-triangle",
      "var(--m3-error)",
      "Bug melden",
      bodyHtml
    );

    const gameSelect = CustomSelect.create(document.getElementById("feedback-bug-game-select"), {
      options: bugGamesOptions(),
      value: "general",
    });

    const categorySelect = CustomSelect.create(document.getElementById("feedback-bug-category-select"), {
      options: BUG_CATEGORIES,
      value: "ui",
    });

    const textarea = document.getElementById("feedback-bug-textarea");
    
    const wizard = setupWizard(
      bugModal.modal,
      3,
      (step) => {
        if (step === 2) return !!textarea.value.trim();
        return true;
      },
      () => {
        const gameId = gameSelect.getValue();
        const game = window.GAMES.find((g) => g.id === gameId);
        const catValue = categorySelect.getValue();
        const catLabel = (BUG_CATEGORIES.find((c) => c.value === catValue) || {}).label || catValue;
        const text = textarea.value.trim();
        
        const labels = ["bug", catValue];
        if (gameId && gameId !== "general") {
          labels.push(`game:${gameId}`);
        }

        GithubFeedback.openIssue({
          title: `Bugreport: ${game ? game.name : "App allgemein"}`,
          body:
            `**Bereich:** ${catLabel}\n` +
            `**Spiel/Kontext:** ${game ? game.name : "Allgemein / System"}\n\n` +
            `**Beschreibung**\n${text}\n`,
          labels: labels,
        });
        bugModal.close();
      }
    );

    textarea.addEventListener("input", () => wizard.validate());
    bugModal.modal.wizard = wizard;

    return bugModal;
  }

  /* ------------------------------------------------------------------ */
  /* Neues Wort vorschlagen                                               */
  /* ------------------------------------------------------------------ */
  let suggestModal = null;

  function ensureSuggestModal() {
    if (suggestModal) return suggestModal;
    
    const bodyHtml = `
      <div class="m3-modal__wizard-steps">
        <!-- Step 1: Spiel -->
        <div data-step="0" class="m3-modal__step">
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 1 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Für welches Spiel?</label>
            <div id="feedback-suggest-game-select"></div>
          </div>
        </div>
        
        <!-- Step 2: Kategorie -->
        <div data-step="1" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 2 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">In welcher Kategorie?</label>
            <div id="feedback-suggest-category-select"></div>
          </div>
        </div>
        
        <!-- Step 3: Vorschlag -->
        <div data-step="2" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 3 von 3</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Dein Vorschlag</label>
            <textarea class="m3-textarea" id="feedback-suggest-text-input" placeholder="z. B. neues Wort, neue Frage oder neuer Prompt…"></textarea>
          </div>
        </div>
      </div>
      
      <div class="m3-modal__actions" style="margin-top: 8px">
        <button type="button" class="m3-button m3-button--text" data-wizard-back style="margin-right: auto;">Zurück</button>
        <button type="button" class="m3-button m3-button--filled" data-wizard-next>Weiter</button>
      </div>
    `;

    suggestModal = buildModal(
      "feedback-suggest-modal",
      "icon-add",
      "var(--m3-primary)",
      "Neues Wort vorschlagen",
      bodyHtml
    );

    const textInput = document.getElementById("feedback-suggest-text-input");
    let categories = [];

    const categorySelect = CustomSelect.create(document.getElementById("feedback-suggest-category-select"), {
      placeholder: "Kategorien werden geladen…",
      onChange: () => wizard && wizard.validate(),
    });

    async function loadCategories(gameId) {
      categorySelect.setOptions([{ value: "", label: "Kategorien werden geladen…" }], "");
      if (wizard) wizard.validate();
      categories = await fetchCategories(gameId);
      const options = categories
        .map((c) => ({ value: c.id, label: `${c.icon || ""} ${c.label}`.trim() }))
        .concat([{ value: "__new__", label: "✨ Neue Kategorie vorschlagen" }]);
      categorySelect.setOptions(options);
      if (wizard) wizard.validate();
    }

    const gameSelect = CustomSelect.create(document.getElementById("feedback-suggest-game-select"), {
      options: gamesWithCategories(),
      onChange: (gameId) => {
        loadCategories(gameId);
        if (wizard) wizard.validate();
      },
    });

    const wizard = setupWizard(
      suggestModal.modal,
      3,
      (step) => {
        if (step === 0) return !!gameSelect.getValue();
        if (step === 1) return !!categorySelect.getValue();
        if (step === 2) return !!textInput.value.trim();
        return true;
      },
      () => {
        const gameId = gameSelect.getValue();
        const game = window.GAMES.find((g) => g.id === gameId);
        const text = textInput.value.trim();
        if (!game || !text) return;
        const catId = categorySelect.getValue();
        const cat = categories.find((c) => c.id === catId);
        const catLabel = catId === "__new__" ? "Neue Kategorie" : cat ? cat.label : catId;

        GithubFeedback.openIssue({
          title: `Wortvorschlag: ${game.name}`,
          body: `**Spiel:** ${game.name}\n**Kategorie:** ${catLabel}\n\n**Vorschlag**\n${text}`,
          labels: ["word-suggestion", `game:${game.id}`],
        });
        suggestModal.close();
      }
    );

    textInput.addEventListener("input", () => wizard.validate());
    suggestModal.modal.wizard = wizard;

    loadCategories(gameSelect.getValue());

    return suggestModal;
  }

  /* ------------------------------------------------------------------ */
  /* Wort melden                                                          */
  /* ------------------------------------------------------------------ */
  let reportModal = null;

  function ensureReportModal() {
    if (reportModal) return reportModal;
    
    const bodyHtml = `
      <div class="m3-modal__wizard-steps">
        <!-- Step 1: Spiel -->
        <div data-step="0" class="m3-modal__step">
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 1 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Aus welchem Spiel?</label>
            <div id="feedback-report-game-select"></div>
          </div>
        </div>
        
        <!-- Step 2: Kategorie -->
        <div data-step="1" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 2 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Aus welcher Kategorie?</label>
            <div id="feedback-report-category-select"></div>
          </div>
        </div>
        
        <!-- Step 3: Wort -->
        <div data-step="2" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 3 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Welches Wort / welche Frage?</label>
            <div id="feedback-report-word-select"></div>
          </div>
        </div>
        
        <!-- Step 4: Grund -->
        <div data-step="3" class="m3-modal__step" hidden>
          <span class="m3-body-small" style="font-weight: bold; color: var(--m3-on-surface-variant)">Schritt 4 von 4</span>
          <div style="margin-top: 12px">
            <label class="m3-field-label">Warum? (optional)</label>
            <textarea class="m3-textarea" id="feedback-report-reason-input" placeholder="Was stimmt damit nicht?"></textarea>
          </div>
        </div>
      </div>
      
      <div class="m3-modal__actions" style="margin-top: 8px">
        <button type="button" class="m3-button m3-button--text" data-wizard-back style="margin-right: auto;">Zurück</button>
        <button type="button" class="m3-button m3-button--filled" data-wizard-next>Weiter</button>
      </div>
    `;

    reportModal = buildModal(
      "feedback-report-modal",
      "icon-close",
      "var(--m3-on-surface-variant)",
      "Wort melden",
      bodyHtml
    );

    const reasonInput = document.getElementById("feedback-report-reason-input");
    let categories = [];

    const wordSelect = CustomSelect.create(document.getElementById("feedback-report-word-select"), {
      placeholder: "Erst Kategorie wählen…",
      onChange: () => wizard && wizard.validate(),
    });

    function loadWords() {
      const catId = categorySelect.getValue();
      const cat = categories.find((c) => c.id === catId);
      const words = cat && Array.isArray(cat.words) ? cat.words.map(normalizeWordEntry) : [];
      wordSelect.setOptions(words.map((w) => ({ value: w.word, label: w.word })));
      if (wizard) wizard.validate();
    }

    const categorySelect = CustomSelect.create(document.getElementById("feedback-report-category-select"), {
      placeholder: "Kategorien werden geladen…",
      onChange: () => {
        loadWords();
        if (wizard) wizard.validate();
      },
    });

    async function loadCategories(gameId) {
      categorySelect.setOptions([], "");
      wordSelect.setOptions([]);
      if (wizard) wizard.validate();
      categories = await fetchCategories(gameId);
      categorySelect.setOptions(categories.map((c) => ({ value: c.id, label: `${c.icon || ""} ${c.label}`.trim() })));
      loadWords();
      if (wizard) wizard.validate();
    }

    const gameSelect = CustomSelect.create(document.getElementById("feedback-report-game-select"), {
      options: gamesWithCategories(),
      onChange: (gameId) => {
        loadCategories(gameId);
        if (wizard) wizard.validate();
      },
    });

    const wizard = setupWizard(
      reportModal.modal,
      4,
      (step) => {
        if (step === 0) return !!gameSelect.getValue();
        if (step === 1) return !!categorySelect.getValue();
        if (step === 2) return !!wordSelect.getValue();
        return true;
      },
      () => {
        const gameId = gameSelect.getValue();
        const game = window.GAMES.find((g) => g.id === gameId);
        const word = wordSelect.getValue();
        if (!game || !word) return;
        const catId = categorySelect.getValue();
        const cat = categories.find((c) => c.id === catId);
        const reason = reasonInput.value.trim();

        GithubFeedback.openIssue({
          title: `Wort-Feedback: ${game.name} – ${word}`,
          body:
            `**Spiel:** ${game.name}\n**Kategorie:** ${cat ? cat.label : catId}\n**Wort/Frage:** ${word}\n\n` +
            `**Warum?**\n${reason || "(kein Grund angegeben)"}`,
          labels: ["word-feedback", `game:${game.id}`, "dislike"],
        });
        reportModal.close();
      }
    );

    reportModal.modal.wizard = wizard;

    loadCategories(gameSelect.getValue());

    return reportModal;
  }

  /* ------------------------------------------------------------------ */
  /* Auslöser                                                             */
  /* ------------------------------------------------------------------ */
  if (bugButton) bugButton.addEventListener("click", () => ensureBugModal().open());
  if (suggestButton) suggestButton.addEventListener("click", () => ensureSuggestModal().open());
  if (reportButton) reportButton.addEventListener("click", () => ensureReportModal().open());

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    [bugModal, suggestModal, reportModal].forEach((m) => {
      if (m && !m.modal.hidden) m.close();
    });
  });
})();
