/**
 * Einmaliger Installations-Hinweis, der NACH der Datenschutz-Zustimmung
 * erscheint (siehe privacy-banner.js, das das "anna:privacyAcked"-Event
 * feuert) - nur wenn window.PwaInstall.isAvailable() true ist, also nur auf
 * Geräten/Browsern, wo ein echter nativer Installieren-Button funktioniert
 * (siehe pwa-install.js). Auf Safari/Firefox erscheint hier bewusst NICHTS.
 *
 * "Nein danke" merkt sich die Ablehnung dauerhaft (kein erneutes Nerven) -
 * die Möglichkeit zu installieren bleibt aber unter Einstellungen bestehen.
 */
(function () {
  const DISMISS_KEY = "anna:pwaInstallDismissed";
  const PRIVACY_KEY = "anna:privacyNoticeAcked";
  const SHOW_DELAY_MS = 400; // kurzer Versatz, damit sich Datenschutz- und Install-Banner nicht überlappen

  function maybeShow() {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (localStorage.getItem(PRIVACY_KEY) !== "1") return; // erst NACH der Zustimmung
    if (!window.PwaInstall || !window.PwaInstall.isAvailable()) return;
    showBanner();
  }

  function showBanner() {
    if (document.querySelector(".pwa-install-banner")) return;

    const banner = document.createElement("div");
    banner.className = "pwa-install-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = `
      <p class="m3-body" style="margin: 0">
        Anna als App installieren – schnellerer Start vom Startbildschirm, auch offline nutzbar.
      </p>
      <div class="pwa-install-banner__actions">
        <button type="button" class="m3-button m3-button--text" id="pwa-install-dismiss">Nein danke</button>
        <button type="button" class="m3-button m3-button--filled" id="pwa-install-confirm">Installieren</button>
      </div>
    `;
    document.body.appendChild(banner);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add("pwa-install-banner--visible"));
    });

    function close() {
      banner.classList.remove("pwa-install-banner--visible");
      setTimeout(() => banner.remove(), 250);
    }

    document.getElementById("pwa-install-dismiss").addEventListener("click", () => {
      localStorage.setItem(DISMISS_KEY, "1");
      close();
    });

    document.getElementById("pwa-install-confirm").addEventListener("click", async () => {
      const choice = await window.PwaInstall.promptInstall();
      close();
      // Nur bei "accepted" dauerhaft ausblenden - bei "dismissed" (z.B.
      // versehentlich im Systemdialog abgebrochen) bleibt die Option unter
      // Einstellungen bestehen, ohne dass wir hier stur nachfragen.
      if (choice && choice.outcome === "accepted") {
        localStorage.setItem(DISMISS_KEY, "1");
      }
    });
  }

  window.addEventListener("anna:privacyAcked", () => {
    setTimeout(maybeShow, SHOW_DELAY_MS);
  });
  if (window.PwaInstall) window.PwaInstall.onChange(maybeShow);

  maybeShow(); // falls Datenschutz schon aus einem früheren Besuch akzeptiert ist
})();
