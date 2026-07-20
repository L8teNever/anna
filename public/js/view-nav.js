/**
 * Gemeinsamer Übergangs-Helfer zwischen "Ansichten" (App-Views) innerhalb
 * einer Seite mit echtem Pfad-Routing (history.pushState) zur Unterstützung
 * des System-Zurück-Buttons auf Android und iOS.
 *
 * URL-Schema:
 *   /bombe                  → setup-view     (Standard)
 *   /bombe/kategorien       → view-category-select
 *   /bombe/spieler          → view-player-select
 *   /bombe/spiel            → play-view
 *   /impostor/aufdecken     → view-reveal
 *   /werbinich/nachschlagen → view-lookup
 */
(function (root) {
  // View-ID → URL-Segment
  const PATH_MAP = {
    "setup-view":           "",
    "view-category-select": "kategorien",
    "view-player-select":   "spieler",
    "play-view":            "spiel",
    "view-reveal":          "aufdecken",
    "view-lookup":          "nachschlagen",
  };

  // URL-Segment → View-ID
  const REVERSE_MAP = {};
  for (const [id, seg] of Object.entries(PATH_MAP)) {
    REVERSE_MAP[seg] = id;
  }

  let isTransitioning = false;

  /** Gibt den Basis-Pfad der aktuellen Seite zurück, z.B. "/bombe" */
  function basePath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return "/" + (parts[0] || "");
  }

  /** Gibt das aktuelle Sub-Segment zurück, z.B. "kategorien" (oder "") */
  function currentSub() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[1] || "";
  }

  // Löst dieselbe Staggered-Pop-Animation aus wie ein echter Seitenaufbau
  // (siehe main.css, Klasse dort heißt page-transition-in) - nur über eine
  // EIGENE body-Klasse statt page-transition-in, damit dabei NICHT
  // zusätzlich die ganze Seite nochmal mit-refadet (das würde bei jedem
  // Öffnen z.B. der Kategorie-Auswahl unnötig den kompletten Bildschirm
  // kurz ausblenden statt nur den neuen View-Inhalt reinpoppen zu lassen).
  function triggerContentPopIn() {
    document.body.classList.remove("view-transition-in");
    void document.body.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
    document.body.classList.add("view-transition-in");
    // Entfernen, sobald alle verzögerten Kinder (Stagger, siehe main.css)
    // fertig animiert sind - längste Verzögerung (0.14s) + Animationsdauer
    // (0.22s) mit Puffer.
    setTimeout(() => {
      document.body.classList.remove("view-transition-in");
    }, 400);
  }

  function performTransition(fromEl, toEl) {
    if (!fromEl || !toEl || fromEl === toEl || isTransitioning) return;
    isTransitioning = true;

    const topbar = document.getElementById("game-topbar");
    if (topbar) topbar.hidden = toEl.hasAttribute("data-hide-topbar");

    fromEl.classList.add("app-view--leaving");
    fromEl.dispatchEvent(new CustomEvent("viewhide", { bubbles: true }));

    setTimeout(() => {
      fromEl.hidden = true;
      fromEl.classList.remove("app-view--leaving");

      toEl.hidden = false;
      toEl.classList.add("app-view--entering");
      toEl.dispatchEvent(new CustomEvent("viewshow", { bubbles: true }));
      triggerContentPopIn();

      requestAnimationFrame(() => {
        toEl.classList.remove("app-view--entering");
        isTransitioning = false;
      });
    }, 160);
  }

  /**
   * Öffentliche API: Navigiert von fromEl zu toEl und ändert dabei die URL.
   * fromEl darf null sein (z.B. beim ersten Aufruf ohne vorherige View).
   */
  function transition(fromEl, toEl) {
    if (!toEl) return;

    const seg = PATH_MAP[toEl.id] !== undefined ? PATH_MAP[toEl.id] : "";
    const newPath = seg ? `${basePath()}/${seg}` : basePath();

    // URL nur pushen, wenn sie sich wirklich ändert
    if (window.location.pathname !== newPath) {
      history.pushState({ viewId: toEl.id }, "", newPath);
    }

    if (fromEl) {
      performTransition(fromEl, toEl);
    } else {
      // Kein fromEl (z.B. beginRound ohne vorherige View-Auswahl):
      // Alle anderen Views verstecken, toEl direkt einblenden
      document.querySelectorAll(".app-view").forEach((v) => {
        if (v !== toEl) v.hidden = true;
      });
      toEl.hidden = false;
      const topbar = document.getElementById("game-topbar");
      if (topbar) topbar.hidden = toEl.hasAttribute("data-hide-topbar");
      toEl.dispatchEvent(new CustomEvent("viewshow", { bubbles: true }));
      triggerContentPopIn();
    }
  }

  let blockPopState = false;

  // Reagiert auf Browser-Zurück/-Vorwärts-Button (System-Back auf Android).
  // { signal } sorgt dafür, dass router.js (siehe dort) diesen Listener bei
  // jedem Seiten-Wechsel automatisch abräumt - sonst würde sich bei jedem
  // Besuch eines neuen Spiels ein weiterer popstate-Listener dieser Datei
  // ansammeln (Speicherleck über eine lange Party-Session).
  window.addEventListener(
    "popstate",
    () => {
      if (blockPopState) {
        blockPopState = false;
        return;
      }

      const currentActive = document.querySelector(".app-view:not([hidden])");

      // Prüfen, ob das Spiel das Verlassen bestätigen möchte
      if (currentActive && typeof window.confirmGameExit === "function") {
        if (!window.confirmGameExit()) {
          blockPopState = true;
          history.go(1); // Wieder einen Schritt vorwärts springen, um das Zurückgehen abzubrechen
          return;
        }
      }

      const sub = currentSub();
      const targetId = REVERSE_MAP[sub] || "setup-view";
      const targetEl = document.getElementById(targetId);

      if (targetEl && currentActive && targetEl !== currentActive) {
        performTransition(currentActive, targetEl);
      }
    },
    { signal: window.Router.signal }
  );

  // Falls die URL beim Aktivieren dieser Seite bereits ein Sub-Segment hat,
  // richtige View zeigen. Läuft entweder nach DOMContentLoaded (echter
  // erster Seitenaufruf, Parsing noch nicht fertig) oder sofort (Aufruf
  // durch router.js nach einem Seiten-Swap - da ist das Dokument längst
  // fertig geladen, DOMContentLoaded feuert dann nie wieder).
  function initFromUrl() {
    const sub = currentSub();
    if (!sub) return; // Standard-View (setup) ist bereits aktiv per HTML
    const targetId = REVERSE_MAP[sub];
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    const currentActive = document.querySelector(".app-view:not([hidden])");
    if (currentActive && currentActive !== targetEl) {
      currentActive.hidden = true;
    }
    targetEl.hidden = false;
    const topbar = document.getElementById("game-topbar");
    if (topbar) topbar.hidden = targetEl.hasAttribute("data-hide-topbar");
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initFromUrl, { signal: window.Router.signal });
  } else {
    initFromUrl();
  }

  root.ViewNav = { transition };
})(window);
