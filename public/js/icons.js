/**
 * Zentrales Icon-Sprite (Material-Symbols-artige Linien-Icons als SVG,
 * selbst gehostet statt Emoji – funktioniert offline, sieht auf jedem
 * Gerät gleich aus). Wird als allererstes Script im <body> jeder Seite
 * eingebunden, damit die <symbol>-Definitionen vor allen <use>-Referenzen
 * im Dokument existieren. Neues Icon = neuer <symbol>-Eintrag hier, danach
 * überall per <svg class="m3-icon"><use href="#icon-name"/></svg> nutzbar.
 */
(function () {
  const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.display = "none";
  sprite.innerHTML = `
    <symbol id="icon-search" viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="6"/><line x1="21" y1="21" x2="15.2" y2="15.2"/>
    </symbol>
    <symbol id="icon-settings" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
      <line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/>
      <line x1="4.9" y1="19.1" x2="7" y2="17"/><line x1="17" y1="7" x2="19.1" y2="4.9"/>
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
  `;
  document.body.prepend(sprite);
})();
