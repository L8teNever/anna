/**
 * Client-seitiges Routing zwischen Start-/Einstellungs-/Rechtliches-/
 * Spiel-Seiten OHNE echten Dokument-Reload - macht den Wechsel genauso
 * flüssig wie die In-Page-Übergänge von view-nav.js innerhalb eines
 * Spiels. Holt die Zielseite per fetch(), tauscht <title>, seiten-
 * spezifische <link rel="stylesheet"> und den kompletten <body>-Inhalt
 * aus und führt die im neuen body enthaltenen <script>-Tags frisch aus.
 *
 * WICHTIG - Lifecycle: Jede Seite bekommt bei ihrer Aktivierung ein
 * frisches AbortSignal (Router.signal). ALLE window/document-Listener,
 * die von Body-Skripten registriert werden, MÜSSEN { signal: Router.signal }
 * übergeben - sonst sammeln sich bei jedem Wechsel doppelte Listener an
 * (Speicherleck über eine lange Party-Session, siehe view-nav.js,
 * ripple.js, touch-fixes.js, wake-lock.js, app.js, bombe.js/shapes.js).
 * Nicht-Listener-Ressourcen (WakeLock, EventSource, Timer) melden sich
 * stattdessen über Router.onTeardown(fn) ab - fn läuft synchron kurz
 * bevor die aktuelle Seite verlassen wird.
 *
 * DIESES SCRIPT (plus icons.js, page-transition.js, pwa-helper.js) lädt
 * bewusst als normales (nicht defer/async) <script> im <head> - NICHT im
 * <body> - jeder Seite: NICHT im body, damit es vom body.innerHTML-Swap
 * unberührt bleibt und nur EINMAL pro echtem Seitenaufruf läuft (nie
 * erneut pro Navigation); NICHT defer, damit es synchron VOR allen
 * <body>-Scripts fertig ist (die brauchen window.Router schon beim
 * eigenen Laden, nicht erst nach DOMContentLoaded).
 */
(function (root) {
  let controller = new AbortController();
  let teardownFns = [];
  let swapping = false;
  let currentTopLevel = topLevelSegment(location.pathname);

  function topLevelSegment(pathname) {
    const seg = pathname.split("/").filter(Boolean)[0];
    return seg ? `/${seg}` : "/";
  }

  function onTeardown(fn) {
    teardownFns.push(fn);
  }

  function runTeardown() {
    controller.abort();
    const fns = teardownFns;
    teardownFns = [];
    fns.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn("[anna] Teardown-Fehler:", err);
      }
    });
    controller = new AbortController();
  }

  // Diese drei lädt jede Seite fest im <head> - nie ersetzen/duplizieren.
  const PERSISTENT_STYLESHEETS = new Set(["/css/material.css", "/css/components.css", "/css/main.css"]);

  function swapHead(newHead) {
    const newTitle = newHead.querySelector("title");
    if (newTitle) document.title = newTitle.textContent;

    const currentStylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const newHrefs = Array.from(newHead.querySelectorAll('link[rel="stylesheet"]')).map((link) =>
      link.getAttribute("href")
    );

    currentStylesheets.forEach((link) => {
      const href = link.getAttribute("href");
      if (!PERSISTENT_STYLESHEETS.has(href) && !newHrefs.includes(href)) {
        link.remove();
      }
    });

    newHrefs.forEach((href) => {
      if (!document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }

  function executeScripts(container) {
    Array.from(container.querySelectorAll("script")).forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      newScript.async = false; // Reihenfolge wie im Dokument erhalten
      oldScript.replaceWith(newScript);
    });
  }

  function playFadeIn() {
    document.body.classList.add("router-navigated");
    document.body.classList.remove("page-transition-in");
    void document.body.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
    document.body.classList.add("page-transition-in");
    // Erst JETZT page-transition-out entfernen, NICHT davor: Solange beide
    // Klassen kurz gleichzeitig da sind, gewinnt laut CSS-Kaskade ohnehin
    // die Animation (page-transition-in) gegen die Transition
    // (page-transition-out) für dieselbe opacity-Eigenschaft - nahtlos.
    // Andersrum (erst -out entfernen, DANN -in setzen) gab es dazwischen
    // einen Moment ganz ohne beide Klassen, in dem body auf seinen
    // ungestylten Default (opacity:1, voll sichtbar) zurückfiel, bevor die
    // Einblend-Animation gleich wieder bei opacity:0 neu startete - das war
    // das doppelte Aufflackern bei jedem Seitenwechsel.
    document.body.classList.remove("page-transition-out");
    document.body.addEventListener(
      "animationend",
      () => document.body.classList.remove("page-transition-in"),
      { once: true }
    );
  }

  async function swapTo(url, { push = true } = {}) {
    if (swapping) return;
    swapping = true;
    document.body.classList.add("page-transition-out");

    try {
      const [res] = await Promise.all([fetch(url), new Promise((resolve) => setTimeout(resolve, 140))]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const newDoc = new DOMParser().parseFromString(html, "text/html");

      runTeardown();
      swapHead(newDoc.head);
      document.body.innerHTML = newDoc.body.innerHTML;
      executeScripts(document.body);

      currentTopLevel = topLevelSegment(new URL(url, location.href).pathname);
      if (push) history.pushState({ annaRouter: true }, "", url);
      window.scrollTo(0, 0);
      playFadeIn();
    } catch (err) {
      console.warn("[anna] Router-Wechsel fehlgeschlagen, normale Navigation:", err);
      window.location.href = url;
      return;
    } finally {
      swapping = false;
    }
  }

  function isRoutableInternalLink(anchor) {
    if (!anchor) return false;
    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
      return false;
    }
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;
    let url;
    try {
      url = new URL(anchor.href, location.href);
    } catch (err) {
      return false;
    }
    return url.origin === location.origin;
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a");
    if (!isRoutableInternalLink(anchor)) return;
    event.preventDefault();
    swapTo(anchor.href);
  });

  window.addEventListener("popstate", () => {
    const newTopLevel = topLevelSegment(location.pathname);
    if (newTopLevel === currentTopLevel) return; // gehört view-nav.js (In-Page-Unteransicht)
    swapTo(location.href, { push: false });
  });

  root.Router = {
    navigate: (url) => swapTo(url),
    onTeardown,
    get signal() {
      return controller.signal;
    },
  };
})(window);
