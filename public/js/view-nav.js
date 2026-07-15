/**
 * Gemeinsamer Übergangs-Helfer zwischen "Ansichten" (App-Views) innerhalb
 * einer Seite mit Hash-Routing zur Unterstützung des System-Zurück-Buttons.
 */
(function (root) {
  const HASH_MAP = {
    "setup-view": "setup",
    "view-category-select": "categories",
    "view-player-select": "players",
    "view-reveal": "reveal",
    "play-view": "play"
  };

  const REVERSE_MAP = {};
  for (const [id, hash] of Object.entries(HASH_MAP)) {
    REVERSE_MAP[hash] = id;
  }

  let isTransitioning = false;

  function performTransition(fromEl, toEl) {
    if (!fromEl || !toEl || fromEl === toEl || isTransitioning) return;
    isTransitioning = true;

    const topbar = document.getElementById("game-topbar");
    if (topbar) topbar.hidden = toEl.hasAttribute("data-hide-topbar");

    fromEl.classList.add("app-view--leaving");
    
    // Dispatch viewhide event on leaving element
    fromEl.dispatchEvent(new CustomEvent("viewhide", { bubbles: true }));

    setTimeout(() => {
      fromEl.hidden = true;
      fromEl.classList.remove("app-view--leaving");
      
      toEl.hidden = false;
      toEl.classList.add("app-view--entering");
      
      // Dispatch viewshow event on entering element
      toEl.dispatchEvent(new CustomEvent("viewshow", { bubbles: true }));

      requestAnimationFrame(() => {
        toEl.classList.remove("app-view--entering");
        isTransitioning = false;
      });
    }, 220);
  }

  function transition(fromEl, toEl) {
    if (!toEl) return;
    const targetHash = HASH_MAP[toEl.id] || "";
    if (window.location.hash.replace("#", "") !== targetHash) {
      window.location.hash = targetHash;
    }
  }

  // Listen for hash changes to perform transitions automatically
  window.addEventListener("hashchange", () => {
    const rawHash = window.location.hash.replace("#", "");
    const targetId = REVERSE_MAP[rawHash] || "setup-view";
    const targetEl = document.getElementById(targetId);
    const currentActive = document.querySelector('.app-view:not([hidden])');

    if (targetEl && currentActive && targetEl !== currentActive) {
      performTransition(currentActive, targetEl);
    }
  });

  // Handle page load with a hash (e.g. direct access or refresh)
  window.addEventListener("DOMContentLoaded", () => {
    const rawHash = window.location.hash.replace("#", "");
    if (rawHash && REVERSE_MAP[rawHash]) {
      const targetId = REVERSE_MAP[rawHash];
      const targetEl = document.getElementById(targetId);
      const currentActive = document.querySelector('.app-view:not([hidden])');
      if (targetEl && currentActive && targetEl !== currentActive) {
        currentActive.hidden = true;
        targetEl.hidden = false;
        const topbar = document.getElementById("game-topbar");
        if (topbar) topbar.hidden = targetEl.hasAttribute("data-hide-topbar");
      }
    }
  });

  root.ViewNav = { transition };
})(window);
