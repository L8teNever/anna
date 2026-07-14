// Shared PWA Service Worker & Update helper
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Create and inject PWA Update Banner dynamically if not present
    if (!document.getElementById('pwa-update-banner')) {
      const banner = document.createElement('div');
      banner.id = 'pwa-update-banner';
      banner.className = 'update-banner';
      banner.innerHTML = `
        <span class="update-banner-text">Eine neue App-Version ist verfügbar!</span>
        <button id="pwa-update-btn" class="update-btn ripple-effect haptic-press">Aktualisieren</button>
      `;
      document.body.appendChild(banner);
    }

    // 2. Register Service Worker (always absolute root path)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker Registered globally');

          // Check if there is already a waiting worker on load
          if (reg.waiting) {
            showUpdateBanner(reg.waiting);
          }

          // Listen for updates found during this session
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner(newWorker);
              }
            });
          });

          // Actively poll for new versions in the background
          setInterval(() => reg.update().catch(() => {}), 60 * 1000);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') reg.update().catch(() => {});
          });
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });

      // Reload once the new worker confirms it has taken control
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          window.location.reload();
        }
      });
    }
  });

  function showUpdateBanner(worker) {
    const banner = document.getElementById('pwa-update-banner');
    const btn = document.getElementById('pwa-update-btn');
    if (banner && btn) {
      banner.classList.add('show');
      btn.onclick = () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
        // Fallback in case the SW_UPDATED confirmation is delayed
        setTimeout(() => window.location.reload(), 400);
      };
    }
  }
})();
