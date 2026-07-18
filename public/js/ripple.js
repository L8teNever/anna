/**
 * Globaler Touch-Ripple + Haptik-Effekt für Buttons/Karten. Einmal pro
 * Seite eingebunden, wirkt auf jedes Element mit m3-Ripple-fähiger Klasse
 * (Buttons, interaktive Karten), ohne dass jede Seite eigenen Code braucht.
 */
(function () {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target.closest(
        "button, .m3-card--interactive, .interactive-item"
      );
      if (!target || target.disabled) return;

      const settings = window.Storage ? Storage.getSettings() : { vibrationEnabled: true };
      if (settings.vibrationEnabled && navigator.vibrate) {
        navigator.vibrate(8);
      }

      const style = getComputedStyle(target);
      if (style.position === "static") target.style.position = "relative";
      if (style.overflow !== "hidden") target.style.overflow = "hidden";

      const ripple = document.createElement("span");
      ripple.className = "m3-ripple";

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

      target.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    },
    { signal: window.Router.signal }
  );
})();
