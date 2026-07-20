/**
 * Logik der Feedback-Seite (/feedback): baut vorausgefüllte GitHub-Issue-
 * Links für Bug-Reports, Wortvorschläge und Wort-Meldungen (siehe
 * github-feedback.js). Spiele/Kategorien/Wörter werden datengetrieben aus
 * game-registry.js + der jeweiligen categories.json geladen - kein
 * hartcodierter Spiele-Katalog hier.
 */
(function () {
  const backButton = document.getElementById("back-button");
  backButton.addEventListener("click", () => {
    PageTransition.navigate("/");
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  // Nur Spiele mit eigener categories.json unterstützen Wort-Feedback
  // (Werwolf hat feste Rollen statt Wörtern, Perfekte Form hat keine
  // Wortliste) - Erkennung rein über die assets-Liste in game-registry.js.
  function gamesWithCategories() {
    return window.GAMES.filter(
      (g) => Array.isArray(g.assets) && g.assets.some((a) => a.endsWith("/categories.json"))
    );
  }

  function categoriesUrlFor(game) {
    return game.assets.find((a) => a.endsWith("/categories.json"));
  }

  function normalizeWordEntry(entry) {
    return typeof entry === "string" ? { word: entry } : { word: entry.word };
  }

  async function fetchCategories(game) {
    try {
      const res = await fetch(categoriesUrlFor(game), { cache: "no-store" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  function populateGameSelect(selectEl) {
    selectEl.innerHTML = gamesWithCategories()
      .map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`)
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Bug melden                                                           */
  /* ------------------------------------------------------------------ */
  const BUG_CATEGORY_LABELS = {
    ui: "Darstellung / UI",
    gameplay: "Spiellogik",
    performance: "Absturz / Performance",
    other: "Sonstiges",
  };

  const bugCategorySelect = document.getElementById("bug-category-select");
  const bugReportButton = document.getElementById("bug-report-button");

  bugReportButton.addEventListener("click", () => {
    const catValue = bugCategorySelect.value;
    GithubFeedback.openIssue({
      title: "Bugreport: ",
      body:
        `**Bereich:** ${BUG_CATEGORY_LABELS[catValue] || catValue}\n\n` +
        `**Beschreibung**\nBitte beschreibe hier das Problem...\n\n` +
        `**Schritte zum Reproduzieren**\n1. \n\n` +
        `**Erwartetes Verhalten**\n\n\n` +
        `**Tatsächliches Verhalten**\n`,
      labels: ["bug", catValue],
    });
  });

  /* ------------------------------------------------------------------ */
  /* Neues Wort vorschlagen                                               */
  /* ------------------------------------------------------------------ */
  const suggestGameSelect = document.getElementById("suggest-game-select");
  const suggestCategorySelect = document.getElementById("suggest-category-select");
  const suggestTextInput = document.getElementById("suggest-text-input");
  const suggestButton = document.getElementById("suggest-word-button");
  let suggestCategories = [];

  async function loadSuggestCategories() {
    suggestCategorySelect.innerHTML = `<option value="">Kategorien werden geladen…</option>`;
    const game = window.GAMES.find((g) => g.id === suggestGameSelect.value);
    if (!game) return;
    suggestCategories = await fetchCategories(game);
    suggestCategorySelect.innerHTML =
      suggestCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.icon || "")} ${escapeHtml(c.label)}</option>`).join("") +
      `<option value="__new__">✨ Neue Kategorie vorschlagen</option>`;
    updateSuggestButtonState();
  }

  function updateSuggestButtonState() {
    suggestButton.disabled = !suggestTextInput.value.trim();
  }

  suggestGameSelect.addEventListener("change", loadSuggestCategories);
  suggestTextInput.addEventListener("input", updateSuggestButtonState);

  suggestButton.addEventListener("click", () => {
    const game = window.GAMES.find((g) => g.id === suggestGameSelect.value);
    const text = suggestTextInput.value.trim();
    if (!game || !text) return;
    const catId = suggestCategorySelect.value;
    const cat = suggestCategories.find((c) => c.id === catId);
    const catLabel = catId === "__new__" ? "Neue Kategorie" : cat ? cat.label : catId;

    GithubFeedback.openIssue({
      title: `Wortvorschlag: ${game.name}`,
      body: `**Spiel:** ${game.name}\n**Kategorie:** ${catLabel}\n\n**Vorschlag**\n${text}`,
      labels: ["word-suggestion", `game:${game.id}`],
    });
  });

  /* ------------------------------------------------------------------ */
  /* Wort melden                                                          */
  /* ------------------------------------------------------------------ */
  const reportGameSelect = document.getElementById("report-game-select");
  const reportCategorySelect = document.getElementById("report-category-select");
  const reportWordSelect = document.getElementById("report-word-select");
  const reportReasonInput = document.getElementById("report-reason-input");
  const reportButton = document.getElementById("report-word-button");
  let reportCategories = [];

  async function loadReportCategories() {
    reportCategorySelect.innerHTML = `<option value="">Kategorien werden geladen…</option>`;
    reportWordSelect.innerHTML = `<option value="">Erst Kategorie wählen…</option>`;
    reportButton.disabled = true;
    const game = window.GAMES.find((g) => g.id === reportGameSelect.value);
    if (!game) return;
    reportCategories = await fetchCategories(game);
    reportCategorySelect.innerHTML = reportCategories
      .map((c) => `<option value="${c.id}">${escapeHtml(c.icon || "")} ${escapeHtml(c.label)}</option>`)
      .join("");
    loadReportWords();
  }

  function loadReportWords() {
    const catId = reportCategorySelect.value;
    const cat = reportCategories.find((c) => c.id === catId);
    const words = cat && Array.isArray(cat.words) ? cat.words.map(normalizeWordEntry) : [];
    reportWordSelect.innerHTML = words.length
      ? words.map((w) => `<option value="${escapeHtml(w.word)}">${escapeHtml(w.word)}</option>`).join("")
      : `<option value="">Keine Wörter gefunden</option>`;
    reportButton.disabled = words.length === 0;
  }

  reportGameSelect.addEventListener("change", loadReportCategories);
  reportCategorySelect.addEventListener("change", loadReportWords);

  reportButton.addEventListener("click", () => {
    const game = window.GAMES.find((g) => g.id === reportGameSelect.value);
    const word = reportWordSelect.value;
    if (!game || !word) return;
    const catId = reportCategorySelect.value;
    const cat = reportCategories.find((c) => c.id === catId);
    const reason = reportReasonInput.value.trim();

    GithubFeedback.openIssue({
      title: `Wort-Feedback: ${game.name} – ${word}`,
      body:
        `**Spiel:** ${game.name}\n**Kategorie:** ${cat ? cat.label : catId}\n**Wort/Frage:** ${word}\n\n` +
        `**Warum?**\n${reason || "(kein Grund angegeben)"}`,
      labels: ["word-feedback", `game:${game.id}`],
    });
  });

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */
  populateGameSelect(suggestGameSelect);
  populateGameSelect(reportGameSelect);
  loadSuggestCategories();
  loadReportCategories();
})();
