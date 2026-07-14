const CACHE_NAME = 'party-games-cache-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/bombe/',
  '/bombe/index.html',
  '/bombe/bombe.js',
  '/truth_dare/',
  '/truth_dare/index.html',
  '/truth_dare/truth_dare.js',
  '/categories/',
  '/categories/index.html',
  '/categories/categories.js',
  '/manifest.json',
  '/css/main.css',
  '/css/components.css',
  '/css/games.css',
  '/js/app.js',
  '/js/wake-lock.js',
  '/js/audio.js',
  '/js/pwa-helper.js',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Install Event - Pre-cache all core assets
// Deliberately does NOT call self.skipWaiting() here: the new worker must
// stay in the "waiting" state until the user confirms via the update banner
// (SKIP_WAITING message below), otherwise the update banner/button is a no-op
// because the update has already applied itself by the time it renders.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all app shell assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Claim clients immediately so the new worker controls the page right away
      return self.clients.claim();
    }).then(() => {
      // Tell every open tab the update is now active so it can reload itself
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
});

// Fetch Event - Serve from Cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  // Only handle requests inside our scope
  if (url.origin !== self.location.origin) return;

  // Handle legacy /games/ redirects offline
  if (url.pathname.startsWith('/games/')) {
    const newPath = url.pathname.replace('/games/', '/');
    const redirectUrl = url.origin + newPath + url.search;
    try {
      event.respondWith(Response.redirect(redirectUrl, 302));
      return;
    } catch (e) {
      // Fallback: serve target directly if Response.redirect fails
      event.respondWith(
        caches.match(newPath).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(redirectUrl);
        })
      );
      return;
    }
  }

  // Trailing slash normalization: redirect '/bombe' to '/bombe/' so relative assets resolve correctly
  const path = url.pathname;
  if (!path.endsWith('/') && !path.split('/').pop().includes('.')) {
    const normalizedUrl = url.origin + path + '/' + url.search;
    try {
      event.respondWith(Response.redirect(normalizedUrl, 302));
      return;
    } catch (e) {
      // Fallback: serve target directly if Response.redirect is unsupported
      event.respondWith(
        caches.match(normalizedUrl).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request);
        })
      );
      return;
    }
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cache but do a background fetch to update cache if possible (stale-while-revalidate style)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Ignore network errors when offline */});
        
        return cachedResponse;
      }
      
      // Fallback to network
      return fetch(event.request);
    })
  );
});

// Listen for the skip waiting message to activate the new version immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
