/**
 * Globales PWA-Helper-Script, das auf JEDER Seite eingebunden wird.
 * Registriert den Service Worker (das muss immer passieren, sonst bieten
 * Chrome/Edge die App gar nicht erst zum Installieren an – siehe sw.js)
 * und zeigt bei einer neuen Version ein Material-Update-Banner oben an.
 * Das Update wird NUR nach Klick auf "Aktualisieren" angewendet (nicht
 * automatisch) – erst dann übernimmt der neue Service Worker und die
 * Seite lädt neu.
 *
 * Offline-Caching selbst ist NUR für die installierte PWA gedacht: läuft
 * die Seite gerade im Standalone-Fenster (App vom Startbildschirm/Desktop
 * geöffnet, nicht im normalen Browser-Tab), schicken wir dem Worker einmal
 * "ENABLE_OFFLINE_CACHE" – ab dann cacht er dauerhaft (auch über künftige
 * Updates hinweg automatisch, siehe sw.js). Ein normaler Browser-Tab
 * schickt diese Nachricht nie und bleibt dadurch bewusst online-only.
 */
(function () {
  if (!("serviceWorker" in navigator)) return;

  // Wie oft aktiv nach einer neueren sw.js gefragt wird, während die Seite
  // offen bleibt. Diese Party-App wird oft einmal geöffnet und stundenlang
  // durchgereicht – ohne das würde ein Update erst beim nächsten kompletten
  // Neustart der App erkannt.
  const UPDATE_CHECK_INTERVAL_MS = 20 * 60 * 1000;

  // display-mode "standalone" deckt Android/Desktop-Installationen ab,
  // "fullscreen"/"minimal-ui" sind seltenere aber gültige Install-Varianten.
  // navigator.standalone ist die ältere iOS-Safari-spezifische Variante
  // ("Zum Home-Bildschirm hinzufügen") – auf anderen Browsern schlicht
  // undefined, daher gefahrlos immer abfragbar.
  function isInstalledPwa() {
    if (window.navigator.standalone === true) return true;
    if (!window.matchMedia) return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches
    );
  }

  function showUpdateModal(onConfirm) {
    if (document.getElementById("update-modal")) return;

    const modal = document.createElement("div");
    modal.id = "update-modal";
    modal.className = "m3-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-live", "polite");
    modal.innerHTML = `
      <div class="m3-modal__backdrop" data-update-backdrop></div>
      <div class="m3-modal__dialog" style="max-width: 360px">
        <h3 class="m3-modal__title">
          <svg class="m3-icon" style="width: 18px; height: 18px; color: var(--m3-primary)"><use href="#icon-info"></use></svg>
          Neue Version verfügbar
        </h3>
        <p class="m3-body" style="margin: 0">
          Für Anna gibt es ein Update mit neuen Funktionen und Verbesserungen.
        </p>
        <div class="m3-modal__actions">
          <button type="button" class="m3-button m3-button--text" data-update-dismiss>Später</button>
          <button type="button" class="m3-button m3-button--filled" id="update-modal-confirm-btn">Aktualisieren</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const backdrop = modal.querySelector("[data-update-backdrop]");
    const dismissBtn = modal.querySelector("[data-update-dismiss]");
    const confirmBtn = modal.querySelector("#update-modal-confirm-btn");

    function close() {
      modal.remove();
    }

    dismissBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);

    confirmBtn.addEventListener("click", () => {
      confirmBtn.textContent = "Wird aktualisiert…";
      confirmBtn.disabled = true;
      dismissBtn.disabled = true;
      onConfirm();
      // Fallback: Falls "SW_ACTIVATED" aus irgendeinem Grund nicht ankommt
      // (Aktivierung hängt fest, alter Worker in einem komischen Zwischen-
      // zustand o.ä.), NICHT einfach nur stumpf neu laden – das würde bei
      // einer wirklich feststeckenden Registrierung nur dieselbe alte
      // Version nochmal laden. Stattdessen komplett zurücksetzen (siehe
      // forceFreshReload): Cache leeren + Worker abmelden + neu laden.
      // Damit führt "Aktualisieren" IMMER zu einem echten frischen Stand,
      // ganz ohne dass man manuell "Cache löschen" suchen muss.
      setTimeout(forceFreshReload, 5000);
    });
  }

  let hasReloaded = false;
  function reloadOnce() {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  }

  // Letzter Rettungsanker, falls der normale Update-Handshake (SKIP_WAITING
  // -> activate -> SW_ACTIVATED) aus irgendeinem Grund nicht durchläuft:
  // alles zurücksetzen statt nur zu hoffen, dass ein einfacher Reload hilft.
  async function forceFreshReload() {
    if (hasReloaded) return;
    hasReloaded = true;
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        // Nur die versionierten Asset-Caches löschen ("anna-cache-<version>",
        // siehe sw.js), NICHT den dauerhaften Flag-Cache ("wurde diese PWA
        // schon mal installiert / Offline-Modus aktiviert") – sonst würde
        // dieser automatische Sicherheitsnetz-Reset bei jedem etwas
        // holprigen Update das Gerät fälschlich wieder wie eine brandneue
        // Installation behandeln. Der Flag-Cache wird bewusst nie über
        // diesen automatischen Pfad gelöscht, sondern nur über den
        // expliziten "Cache löschen"-Button (siehe cache-tools.js).
        await Promise.all(
          names.filter((name) => name.startsWith("anna-cache-")).map((name) => caches.delete(name))
        );
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (err) {
      // Aufräumen fehlgeschlagen -> trotzdem neu laden, besser als nichts.
    }
    window.location.reload();
  }

  // Nur wenn diese Seite VOR der Registrierung unten schon einen
  // Controller hatte, ist ein späteres SW_ACTIVATED/controllerchange ein
  // ECHTES Update (alter Worker -> neuer Worker) und rechtfertigt einen
  // automatischen Reload. Beim allerersten Laden dieser Origin (oder
  // direkt nach "Cache löschen", das den Worker komplett neu registriert,
  // siehe cache-tools.js) gibt es hier noch KEINEN Controller: der erste
  // clients.claim() im Worker "übernimmt" dann nur die bereits frisch
  // geladene Seite – das ist kein Update und darf keinen ungefragten
  // Reload auslösen (sonst reloadet die Seite z.B. beim allerersten
  // Besuch von selbst, oder nach "Cache löschen" gleich zweimal).
  const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);

  // Listen to messages from the Service Worker
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SW_ACTIVATED") {
      if (!hadControllerAtLoad) return; // erster Claim, kein echtes Update
      console.log("[anna] SW_ACTIVATED received. Clean reloading page.");
      reloadOnce();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Nur in der installierten PWA den dauerhaften Offline-Modus im
      // Worker anschalten (siehe sw.js) – ein normaler Browser-Tab lässt
      // das bewusst aus und bleibt online-only. navigator.serviceWorker.ready
      // wartet zuverlässig, bis es einen aktiven Worker gibt (auch bei der
      // allerersten Installation, die noch kurz "installing" sein kann).
      if (isInstalledPwa()) {
        navigator.serviceWorker.ready.then((readyRegistration) => {
          if (readyRegistration.active) {
            readyRegistration.active.postMessage({ type: "ENABLE_OFFLINE_CACHE" });
          }
        });
      }

      // Fall 1: Es gibt bereits einen wartenden Worker (Update wurde auf
      // einer anderen Seite/Tab entdeckt, Nutzer hat aber noch nicht bestätigt).
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateModal(() => {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        });
      }

      // Fall 2: Ein neuer Worker wird gerade installiert.
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateModal(() => {
              installingWorker.postMessage({ type: "SKIP_WAITING" });
            });
          }
        });
      });

      // Aktiv nachfragen statt nur auf die (seltenen) automatischen
      // Browser-Checks zu warten: sobald die Seite wieder sichtbar wird
      // (App aus dem Hintergrund geholt) und danach regelmäßig, solange
      // sie offen bleibt. Cooldown: max. 1× alle 10 Minuten beim
      // Sichtbarkeits-Wechsel, damit kein dauerhafter Browser-Ladeindikator
      // am Bildschirmrand erscheint.
      let lastUpdateCheck = 0;
      const UPDATE_COOLDOWN_MS = 10 * 60 * 1000;

      // WICHTIG: sofort bei jedem (Neu-)Start prüfen, nicht erst warten.
      // "visibilitychange" feuert nur bei einem WECHSEL des Sichtbarkeits-
      // Status – eine frisch geladene Seite ist von Anfang an sichtbar,
      // es gibt also gar keinen Wechsel zum Reagieren. Ohne diesen Aufruf
      // hier hätte ein Nutzer, der die App schließt und direkt wieder
      // öffnet, erst nach dem 20-Minuten-Intervall überhaupt eine Chance,
      // eine neue Version zu sehen (Browser selbst prüfen von sich aus nur
      // gedrosselt, teils erst nach 24 Stunden).
      lastUpdateCheck = Date.now();
      registration.update().catch(() => {});

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        const now = Date.now();
        if (now - lastUpdateCheck < UPDATE_COOLDOWN_MS) return;
        lastUpdateCheck = now;
        registration.update().catch(() => {});
      });
      setInterval(() => {
        lastUpdateCheck = Date.now();
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    }).catch((err) => {
      console.warn("[anna] Service-Worker-Registrierung fehlgeschlagen:", err);
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadControllerAtLoad) return; // erster Claim, kein echtes Update
      // controllerchange ist der Standard-Trigger, wir lassen ihn als Fallback aktiv
      // falls der Worker die Aktivierungsnachricht nicht abschicken kann.
      setTimeout(reloadOnce, 1000);
    });
  });
})();
