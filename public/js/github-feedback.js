/**
 * Baut vorausgefüllte GitHub-Issue-Links (Titel + Beschreibung + Labels) für
 * Bug-Reports und Wort-/Kategorie-Feedback - komplett clientseitig über die
 * offizielle GitHub-URL-Vorbefüllung (?title=&body=&labels=), OHNE eigenes
 * Backend/eigene Datenbank. GitHub Issues sind bewusst die "Datenbank" für
 * Feedback dieser App - passt zur Datensparsamkeits-Philosophie (siehe
 * Datenschutzerklärung): wir sammeln selbst nichts, alles landet direkt und
 * einsehbar im öffentlichen Repo.
 *
 * Labels müssen im Repo existieren, damit sie beim Issue tatsächlich
 * angehängt werden (GitHub ignoriert unbekannte Label-Namen in der URL
 * stillschweigend, statt einen Fehler zu zeigen) - siehe ADMIN.md für die
 * Liste der erwarteten Labels.
 */
(function (root) {
  const REPO = "L8teNever/anna";
  const MAX_BODY_LENGTH = 3000; // grobe Sicherheitsmarge gegen Browser-URL-Längenlimits

  function versionSuffix() {
    return `\n\n---\nApp-Version: ${root.APP_VERSION || "unbekannt"}`;
  }

  function buildIssueUrl({ title, body, labels }) {
    let fullBody = (body || "") + versionSuffix();
    if (fullBody.length > MAX_BODY_LENGTH) {
      fullBody = fullBody.slice(0, MAX_BODY_LENGTH) + "\n\n[…gekürzt]";
    }
    const params = new URLSearchParams();
    if (title) params.set("title", title);
    if (fullBody) params.set("body", fullBody);
    if (labels && labels.length) params.set("labels", labels.join(","));
    return `https://github.com/${REPO}/issues/new?${params.toString()}`;
  }

  function openIssue(opts) {
    const url = buildIssueUrl(opts);
    window.open(url, "_blank", "noopener");
    return url;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  /**
   * Rendert ein schlichtes "Fandst du den Begriff dieser Runde gut?"
   * 👍/👎-Widget in den übergebenen Container - genutzt von den Runden-
   * Ende-Bildschirmen der Spiele mit eigener categories.json (Bombe,
   * Impostor, Ich hab noch nie, Wer würde eher, Wer bin ich?). Ein Klick
   * öffnet sofort das passend vorausgefüllte Issue, kein Zwischenschritt -
   * bewusst niedrigschwellig, für ausführlicheres Feedback mit Begründung
   * gibt es die /feedback-Seite.
   *
   * WICHTIG: das Wort selbst steht bewusst NICHT im sichtbaren Label, nur
   * im Hintergrund im generierten Issue - bei Impostor wird die
   * Diskussionsphase (wo dieses Widget u.a. erscheint) sonst versehentlich
   * zum Leck: alle sehen denselben Bildschirm, das Geheimwort darf dort
   * nicht plötzlich in Klartext auftauchen.
   */
  function renderQuickRating(container, { gameId, gameName, categoryLabel, word }) {
    if (!container || !word) return;
    container.hidden = false;
    container.innerHTML = `
      <span class="quick-rating__label">Fandest du den Begriff dieser Runde gut?</span>
      <div class="quick-rating__buttons">
        <button type="button" class="m3-button m3-button--text" data-rating="good">👍 Gut</button>
        <button type="button" class="m3-button m3-button--text" data-rating="bad">👎 Nicht so gut</button>
      </div>
    `;
    container.querySelectorAll("[data-rating]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const isGood = btn.dataset.rating === "good";
        openIssue({
          title: `Wort-Feedback (${isGood ? "👍" : "👎"}): ${gameName} – ${word}`,
          body:
            `**Spiel:** ${gameName}\n**Kategorie:** ${categoryLabel || "-"}\n` +
            `**Wort/Frage:** ${word}\n**Bewertung:** ${isGood ? "Gut 👍" : "Nicht so gut 👎"}`,
          labels: ["word-feedback", `game:${gameId}`],
        });
        container.innerHTML = `<span class="quick-rating__thanks">Danke fürs Feedback! 🙌</span>`;
      });
    });
  }

  root.GithubFeedback = { REPO, buildIssueUrl, openIssue, renderQuickRating };
})(window);
