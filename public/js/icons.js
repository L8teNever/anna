/**
 * Zentrales Icon-Sprite (Material-Symbols-artige Linien-Icons als SVG,
 * selbst gehostet statt Emoji – funktioniert offline, sieht auf jedem
 * Gerät gleich aus). Lädt als `defer`-Script im <head> jeder Seite (siehe
 * router.js: nur Session-globale Head-Scripts überleben einen
 * Seiten-Swap unverändert), damit die <symbol>-Definitionen vor allen
 * <use>-Referenzen im Dokument existieren. Neues Icon = neuer
 * <symbol>-Eintrag hier, danach überall per
 * <svg class="m3-icon"><use href="#icon-name"/></svg> nutzbar.
 */
(function () {
  // Idempotent + im <head> statt <body>: dieses Script lädt einmalig als
  // Head-Script (siehe <head> jeder Seite) und wird vom Router NIE erneut
  // ausgeführt. Läge das Sprite in <body>, würde es beim Seiten-Swap
  // (body.innerHTML wird ersetzt) mitgelöscht und alle <use href="#icon-…">
  // liefen ins Leere.
  if (document.getElementById("anna-icon-sprite")) return;
  const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.id = "anna-icon-sprite";
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.display = "none";
  sprite.innerHTML = `
    <symbol id="icon-target" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-search" viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="6"/><line x1="21" y1="21" x2="15.2" y2="15.2"/>
    </symbol>
    <symbol id="icon-settings" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </symbol>
    <symbol id="icon-arrow-back" viewBox="0 0 24 24">
      <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
    </symbol>
    <symbol id="icon-close" viewBox="0 0 24 24">
      <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
    </symbol>
    <symbol id="icon-add" viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </symbol>
    <symbol id="icon-edit" viewBox="0 0 24 24">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </symbol>
    <symbol id="icon-bomb" viewBox="0 0 24 24">
      <circle cx="10.5" cy="14.5" r="6.5"/>
      <line x1="14.8" y1="10.2" x2="18" y2="7"/>
      <circle cx="19" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-burst" viewBox="0 0 24 24">
      <line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/>
      <line x1="4.9" y1="4.9" x2="8.5" y2="8.5"/><line x1="15.5" y1="15.5" x2="19.1" y2="19.1"/>
      <line x1="4.9" y1="19.1" x2="8.5" y2="15.5"/><line x1="15.5" y1="8.5" x2="19.1" y2="4.9"/>
    </symbol>
    <symbol id="icon-masks" viewBox="0 0 24 24">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </symbol>
    <symbol id="icon-grid" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </symbol>
    <symbol id="icon-heart" viewBox="0 0 24 24">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
    </symbol>
    <symbol id="icon-sliders" viewBox="0 0 24 24">
      <line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/>
      <line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>
      <line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-arrow-up-right" viewBox="0 0 24 24">
      <path d="M7 17L17 7"/><path d="M8 7h9v9"/>
    </symbol>
    <symbol id="icon-check" viewBox="0 0 24 24">
      <path d="M20 6L9 17l-5-5"/>
    </symbol>
    <symbol id="icon-users" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </symbol>
    <symbol id="icon-chevron-right" viewBox="0 0 24 24">
      <path d="M9 18l6-6-6-6"/>
    </symbol>
    <symbol id="icon-play" viewBox="0 0 24 24">
      <path d="M6 3l15 9-15 9V3z" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-alert-triangle" viewBox="0 0 24 24">
      <path d="M12 2 1 21h22L12 2z"/><line x1="12" y1="9" x2="12" y2="14"/>
      <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-info" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/>
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-chevron-up" viewBox="0 0 24 24">
      <path d="M6 15l6-6 6 6"/>
    </symbol>
    <symbol id="icon-minus" viewBox="0 0 24 24">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </symbol>
    <symbol id="icon-touch" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.5"/>
      <circle cx="12" cy="12" r="9" opacity="0.45"/>
    </symbol>
    <symbol id="icon-trophy" viewBox="0 0 24 24">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/>
      <path d="M7 5H5a2 2 0 0 0 0 4h2"/><path d="M17 5h2a2 2 0 0 1 0 4h-2"/>
      <path d="M12 13v4"/><path d="M8 21h8"/>
    </symbol>
    <symbol id="icon-drag-handle" viewBox="0 0 24 24">
      <circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-drink" viewBox="0 0 24 24">
      <path d="M4 4h16l-8 10z"/>
      <line x1="12" y1="14" x2="12" y2="20"/>
      <line x1="8" y1="20" x2="16" y2="20"/>
    </symbol>
    <symbol id="icon-shapes" viewBox="0 0 24 24">
      <circle cx="9" cy="9" r="6"/>
      <rect x="9" y="9" width="12" height="12" rx="1.5"/>
    </symbol>
    <symbol id="icon-shape-circle" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/>
    </symbol>
    <symbol id="icon-shape-rectangle" viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="12" rx="1.5"/>
    </symbol>
    <symbol id="icon-shape-triangle" viewBox="0 0 24 24">
      <path d="M12 3 21 20H3Z"/>
    </symbol>
    <symbol id="icon-shape-star" viewBox="0 0 24 24">
      <path d="M12 2.5l2.6 6.4 6.9.5-5.3 4.4 1.8 6.7L12 16.9 5.9 20.5l1.8-6.7-5.3-4.4 6.9-.5Z"/>
    </symbol>
    <symbol id="icon-question" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.3-1.7 2.7"/>
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-moon" viewBox="0 0 24 24">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>
    </symbol>
    <symbol id="icon-sound-on" viewBox="0 0 24 24">
      <path d="M4 9v6h4l5 5V4L8 9H4Z"/>
      <path d="M16 8.5a5 5 0 0 1 0 7"/>
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12"/>
    </symbol>
    <symbol id="icon-sound-off" viewBox="0 0 24 24">
      <path d="M4 9v6h4l5 5V4L8 9H4Z"/>
      <line x1="16" y1="9" x2="22" y2="15"/>
      <line x1="22" y1="9" x2="16" y2="15"/>
    </symbol>
  `;
  document.head.appendChild(sprite);
})();
