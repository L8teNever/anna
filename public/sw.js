/**
 * Service Worker: cacht die komplette App (Startseite, Einstellungen, alle
 * Spiele) beim Install, damit danach ALLES offline spielbar ist – nicht nur
 * das zuletzt besuchte Spiel. Strategie beim Ausliefern ist "cache-first,
 * dann im Hintergrund aktualisieren" (stale-while-revalidate).
 *
 * Update-Ablauf:
 *  1. APP_VERSION hier hochzählen, sobald sich Design/Spiele/Code ändern.
 *  2. Der Browser erkennt die neue sw.js (Byte-Diff), installiert sie im
 *     Hintergrund und füllt einen NEUEN Cache (alter Cache bleibt aktiv).
 *  3. pwa-helper.js zeigt daraufhin auf allen offenen Seiten das
 *     Update-Banner. Erst nach Klick auf "Aktualisieren" schickt die Seite
 *     ein SKIP_WAITING an diesen Worker.
 *  4. activate() räumt danach alte Caches auf, ab jetzt läuft alles wieder
 *     komplett offline mit dem neuen Stand.
 */

const APP_VERSION = "1.0.0";
const CACHE_NAME = `anna-cache-${APP_VERSION}`;

importScripts("/js/game-registry.js");

const CORE_ASSETS = [
  "/",
  "/settings",
  "/manifest.json",
  "/css/material.css",
  "/css/components.css",
  "/css/main.css",
  "/js/storage.js",
  "/js/game-registry.js",
  "/js/app.js",
  "/js/settings.js",
  "/js/wake-lock.js",
  "/js/audio.js",
  "/js/pwa-helper.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-192-maskable.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/icon-512-maskable.png",
];

const GAME_ASSETS = (self.GAMES || []).flatMap((game) => [`/${game.id}`, ...game.assets]);

const PRECACHE_URLS = [...CORE_ASSETS, ...GAME_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
