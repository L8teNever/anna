/**
 * Einmaliger Hinweis-Banner: informiert beim allerersten Besuch knapp
 * darüber, dass Daten (Spielerliste, Einstellungen, ...) nur lokal auf dem
 * Gerät liegen und es keine Cookies/kein Tracking gibt. Kein
 * Cookie-Consent im rechtlichen Sinne (dafür gibt es hier nichts
 * einzuwilligen, siehe Datenschutzerklärung Abschnitt 4/8) - reine
 * Transparenz, die man einmal wegklicken kann.
 */
(function () {
  const KEY = "anna:privacyNoticeAcked";
  if (localStorage.getItem(KEY) === "1") return;

  const banner = document.createElement("div");
  banner.className = "privacy-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = `
    <p class="m3-body" style="margin: 0">
      Anna speichert Spielernamen, Favoriten und Einstellungen nur lokal auf diesem Gerät.
      Keine Cookies, kein Tracking, keine Werbung.
      <a href="/rechtliches#datenschutz">Mehr in der Datenschutzerklärung</a>.
    </p>
    <div class="privacy-banner__actions">
      <button type="button" class="m3-button m3-button--filled" id="privacy-banner-ack">Verstanden</button>
    </div>
  `;
  document.body.appendChild(banner);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add("privacy-banner--visible"));
  });

  document.getElementById("privacy-banner-ack").addEventListener("click", () => {
    localStorage.setItem(KEY, "1");
    banner.classList.remove("privacy-banner--visible");
    setTimeout(() => banner.remove(), 250);
    // Signal für pwa-install-banner.js: darf jetzt (mit kurzem Versatz)
    // den Installations-Hinweis zeigen, statt beide Banner zu überlappen.
    window.dispatchEvent(new CustomEvent("anna:privacyAcked"));
  });
})();
