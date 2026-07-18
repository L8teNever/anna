/**
 * Gemeinsames Wake-Lock-Utility. Spiele wie "Tickende Bombe" rufen
 * WakeLock.enable() beim Start und WakeLock.disable() beim Ende auf, damit
 * der Bildschirm während der Runde nicht ausgeht. Nutzt die native
 * Screen-Wake-Lock-API mit stillem Fallback, falls der Browser sie nicht
 * unterstützt.
 */
(function (root) {
  let sentinel = null;
  let wanted = false;

  async function requestLock() {
    if (!wanted || !("wakeLock" in navigator)) return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", () => {
        sentinel = null;
      });
    } catch (err) {
      sentinel = null;
    }
  }

  document.addEventListener(
    "visibilitychange",
    () => {
      if (wanted && document.visibilityState === "visible" && sentinel === null) {
        requestLock();
      }
    },
    { signal: window.Router.signal }
  );

  root.WakeLock = {
    async enable() {
      wanted = true;
      await requestLock();
    },
    async disable() {
      wanted = false;
      if (sentinel) {
        try {
          await sentinel.release();
        } catch (err) {
          /* bereits freigegeben */
        }
        sentinel = null;
      }
    },
  };
})(window);
