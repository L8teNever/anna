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
      let newWorker;

      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker Registered globally');

          // Check if there is already a waiting worker on load
          if (reg.waiting) {
            showUpdateBanner(reg.waiting);
          }

          // Listen for updates
          reg.addEventListener('updatefound', () => {
            newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New update available, show banner
                  showUpdateBanner(newWorker);
                }
              }
            });
          });
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });

      // Handle skipWaiting reload
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          window.location.reload();
          refreshing = true;
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
        worker.postMessage({ action: 'skipWaiting' });
        banner.classList.remove('show');
      };
    }
  }
})();
