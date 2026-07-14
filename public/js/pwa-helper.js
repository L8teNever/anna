/**
 * Globales PWA-Helper-Script, das auf JEDER Seite eingebunden wird.
 * Registriert den Service Worker und zeigt bei einer neuen Version ein
 * Material-Update-Banner oben an. Das Update wird NUR nach Klick auf
 * "Aktualisieren" angewendet (nicht automatisch) – erst dann übernimmt der
 * neue Service Worker und die Seite lädt neu.
 */
(function () {
  if (!("serviceWorker" in navigator)) return;

  // Wie oft aktiv nach einer neueren sw.js gefragt wird, während die Seite
  // offen bleibt. Diese Party-App wird oft einmal geöffnet und stundenlang
  // durchgereicht – ohne das würde ein Update erst beim nächsten kompletten
  // Neustart der App erkannt.
  const UPDATE_CHECK_INTERVAL_MS = 20 * 60 * 1000;

  function showUpdateBanner(onConfirm) {
    if (document.querySelector(".update-banner")) return;

    const banner = document.createElement("div");
    banner.className = "update-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <span class="update-banner__text">Neue Version verfügbar</span>
      <div class="update-banner__actions">
        <button type="button" class="update-banner__dismiss" aria-label="Schließen">Später</button>
        <button type="button" class="update-banner__confirm">Aktualisieren</button>
      </div>
    `;
    document.body.prepend(banner);
    requestAnimationFrame(() => banner.classList.add("update-banner--visible"));

    banner.querySelector(".update-banner__dismiss").addEventListener("click", () => {
      banner.classList.remove("update-banner--visible");
      setTimeout(() => banner.remove(), 200);
    });

    banner.querySelector(".update-banner__confirm").addEventListener("click", () => {
      banner.querySelector(".update-banner__confirm").textContent = "Wird aktualisiert…";
      onConfirm();
      // Fallback: falls "SW_ACTIVATED" aus irgendeinem Grund nicht
      // empfangen wird, trotzdem nach 4 Sekunden neu laden.
      setTimeout(reloadOnce, 4000);
    });
  }

  let hasReloaded = false;
  function reloadOnce() {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  }

  // Listen to messages from the Service Worker
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SW_ACTIVATED") {
      console.log("[anna] SW_ACTIVATED received. Clean reloading page.");
      reloadOnce();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Fall 1: Es gibt bereits einen wartenden Worker (Update wurde auf
      // einer anderen Seite/Tab entdeckt, Nutzer hat aber noch nicht bestätigt).
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(() => {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        });
      }

      // Fall 2: Ein neuer Worker wird gerade installiert.
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(() => {
              installingWorker.postMessage({ type: "SKIP_WAITING" });
            });
          }
        });
      });

      // Aktiv nachfragen statt nur auf die (seltenen) automatischen
      // Browser-Checks zu warten: sobald die Seite wieder sichtbar wird
      // (App aus dem Hintergrund geholt) und danach regelmäßig, solange
      // sie offen bleibt.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {});
      });
      setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_INTERVAL_MS);
    }).catch((err) => {
      console.warn("[anna] Service-Worker-Registrierung fehlgeschlagen:", err);
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // controllerchange ist der Standard-Trigger, wir lassen ihn als Fallback aktiv
      // falls der Worker die Aktivierungsnachricht nicht abschicken kann.
      setTimeout(reloadOnce, 1000);
    });
  });
})();
