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
    bugModal = buildModal(
      "feedback-bug-modal",
      "icon-alert-triangle",
      "var(--m3-error)",
      "Bug melden",
      `
        <p class="m3-body" style="margin: 0">
          Kurz einordnen, den Rest (Beschreibung, Schritte) füllst du direkt im GitHub-Formular aus.
        </p>
        <div>
          <label class="m3-field-label">Worum geht's ungefähr?</label>
          <div id="feedback-bug-category-select"></div>
        </div>
        <div class="m3-modal__actions">
          <button type="button" class="m3-button m3-button--filled" id="feedback-bug-submit" style="width: 100%">
            Auf GitHub öffnen
          </button>
        </div>
      `
    );

    const categorySelect = CustomSelect.create(document.getElementById("feedback-bug-category-select"), {
      options: BUG_CATEGORIES,
      value: "ui",
    });

    document.getElementById("feedback-bug-submit").addEventListener("click", () => {
      const catValue = categorySelect.getValue();
      const catLabel = (BUG_CATEGORIES.find((c) => c.value === catValue) || {}).label || catValue;
      GithubFeedback.openIssue({
        title: "Bugreport: ",
        body:
          `**Bereich:** ${catLabel}\n\n` +
          `**Beschreibung**\nBitte beschreibe hier das Problem...\n\n` +
          `**Schritte zum Reproduzieren**\n1. \n\n` +
          `**Erwartetes Verhalten**\n\n\n` +
          `**Tatsächliches Verhalten**\n`,
        labels: ["bug", catValue],
      });
      bugModal.close();
    });

    return bugModal;
  }

  /* ------------------------------------------------------------------ */
  /* Neues Wort vorschlagen                                               */
  /* ------------------------------------------------------------------ */
  let suggestModal = null;

  function ensureSuggestModal() {
    if (suggestModal) return suggestModal;
    suggestModal = buildModal(
      "feedback-suggest-modal",
      "icon-add",
      "var(--m3-primary)",
      "Neues Wort vorschlagen",
      `
        <p class="m3-body" style="margin: 0">
          Spiel und Kategorie auswählen, Vorschlag eintippen – der fertige Link wird direkt gebaut.
        </p>
        <div>
          <label class="m3-field-label">Spiel</label>
          <div id="feedback-suggest-game-select"></div>
        </div>
        <div>
          <label class="m3-field-label">Kategorie</label>
          <div id="feedback-suggest-category-select"></div>
        </div>
        <div>
          <label class="m3-field-label">Dein Vorschlag</label>
          <textarea class="m3-textarea" id="feedback-suggest-text-input" placeholder="z. B. neues Wort, neue Frage oder neuer Prompt…"></textarea>
        </div>
        <div class="m3-modal__actions">
          <button type="button" class="m3-button m3-button--filled" id="feedback-suggest-submit" style="width: 100%" disabled>
            Auf GitHub öffnen
          </button>
        </div>
      `
    );

    const textInput = document.getElementById("feedback-suggest-text-input");
    const submitButton = document.getElementById("feedback-suggest-submit");
    let categories = [];

    function updateSubmitState() {
      submitButton.disabled = !textInput.value.trim();
    }

    const categorySelect = CustomSelect.create(document.getElementById("feedback-suggest-category-select"), {
      placeholder: "Kategorien werden geladen…",
    });

    async function loadCategories(gameId) {
      categorySelect.setOptions([{ value: "", label: "Kategorien werden geladen…" }], "");
      categories = await fetchCategories(gameId);
      const options = categories
        .map((c) => ({ value: c.id, label: `${c.icon || ""} ${c.label}`.trim() }))
        .concat([{ value: "__new__", label: "✨ Neue Kategorie vorschlagen" }]);
      categorySelect.setOptions(options);
    }

    const gameSelect = CustomSelect.create(document.getElementById("feedback-suggest-game-select"), {
      options: gamesWithCategories(),
      onChange: (gameId) => loadCategories(gameId),
    });

    textInput.addEventListener("input", updateSubmitState);

    submitButton.addEventListener("click", () => {
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
    });

    loadCategories(gameSelect.getValue());

    return suggestModal;
  }

  /* ------------------------------------------------------------------ */
  /* Wort melden                                                          */
  /* ------------------------------------------------------------------ */
  let reportModal = null;

  function ensureReportModal() {
    if (reportModal) return reportModal;
    reportModal = buildModal(
      "feedback-report-modal",
      "icon-close",
      "var(--m3-on-surface-variant)",
      "Wort melden",
      `
        <p class="m3-body" style="margin: 0">
          Für ein Wort/eine Frage, das/die dir nicht gefällt oder nicht passt.
        </p>
        <div>
          <label class="m3-field-label">Spiel</label>
          <div id="feedback-report-game-select"></div>
        </div>
        <div>
          <label class="m3-field-label">Kategorie</label>
          <div id="feedback-report-category-select"></div>
        </div>
        <div>
          <label class="m3-field-label">Wort / Frage</label>
          <div id="feedback-report-word-select"></div>
        </div>
        <div>
          <label class="m3-field-label">Warum? (optional)</label>
          <textarea class="m3-textarea" id="feedback-report-reason-input" placeholder="Was stimmt damit nicht?"></textarea>
        </div>
        <div class="m3-modal__actions">
          <button type="button" class="m3-button m3-button--filled" id="feedback-report-submit" style="width: 100%" disabled>
            Auf GitHub öffnen
          </button>
        </div>
      `
    );

    const reasonInput = document.getElementById("feedback-report-reason-input");
    const submitButton = document.getElementById("feedback-report-submit");
    let categories = [];

    const wordSelect = CustomSelect.create(document.getElementById("feedback-report-word-select"), {
      placeholder: "Erst Kategorie wählen…",
    });

    function loadWords() {
      const catId = categorySelect.getValue();
      const cat = categories.find((c) => c.id === catId);
      const words = cat && Array.isArray(cat.words) ? cat.words.map(normalizeWordEntry) : [];
      wordSelect.setOptions(words.map((w) => ({ value: w.word, label: w.word })));
      submitButton.disabled = words.length === 0;
    }

    const categorySelect = CustomSelect.create(document.getElementById("feedback-report-category-select"), {
      placeholder: "Kategorien werden geladen…",
      onChange: loadWords,
    });

    async function loadCategories(gameId) {
      categorySelect.setOptions([], "");
      wordSelect.setOptions([]);
      submitButton.disabled = true;
      categories = await fetchCategories(gameId);
      categorySelect.setOptions(categories.map((c) => ({ value: c.id, label: `${c.icon || ""} ${c.label}`.trim() })));
      loadWords();
    }

    const gameSelect = CustomSelect.create(document.getElementById("feedback-report-game-select"), {
      options: gamesWithCategories(),
      onChange: (gameId) => loadCategories(gameId),
    });

    submitButton.addEventListener("click", () => {
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
    });

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
