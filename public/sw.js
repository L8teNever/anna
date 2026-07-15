/**
 * Service Worker: Offline-Caching gibt es NUR für die installierte PWA
 * (Startbildschirm/App-Fenster im "standalone"-Modus) – ein normaler
 * Browser-Tab bleibt bewusst online-only und cacht nichts. Der Worker
 * selbst wird trotzdem IMMER registriert (auch im Browser-Tab), weil
 * Chrome/Edge einen aktiven Service Worker mit fetch-Handler brauchen,
 * damit der native "App installieren"-Vorschlag überhaupt erscheint
 * (sonst wäre die App nie als PWA installierbar). Ob tatsächlich gecacht
 * wird, entscheidet dieser Worker selbst anhand eines dauerhaften, von
 * der Versionsnummer unabhängigen Flags (FLAG_CACHE) – siehe unten.
 *
 * Ablauf:
 *  1. pwa-helper.js erkennt beim Laden, ob die Seite im PWA-Standalone-
 *     Modus läuft (display-mode: standalone/fullscreen/minimal-ui bzw.
 *     iOS navigator.standalone) und schickt in diesem Fall EINMAL die
 *     Nachricht { type: "ENABLE_OFFLINE_CACHE" } an diesen Worker.
 *  2. enableOfflineMode() setzt daraufhin das Flag (bleibt über Neustarts
 *     des Workers UND über App-Updates hinweg erhalten, da es in einer
 *     eigenen, versionsunabhängigen Cache-Storage-"Datenbank" liegt) und
 *     lädt einmalig die komplette App in den Cache.
 *  3. Ab jetzt (und bei jedem künftigen install()) prüft dieser Worker das
 *     Flag: ist es gesetzt, wird bei JEDEM Update automatisch der
 *     komplette neue Stand vorab gecacht – ganz ohne dass die Seite die
 *     Nachricht erneut schicken muss. Ist es NICHT gesetzt (reiner
 *     Browser-Tab, nie als PWA geöffnet), bleibt der Worker ein reiner
 *     Passthrough: fetch-Anfragen gehen 1:1 ans Netz, nichts wird gecacht.
 *  4. APP_VERSION hier hochzählen, sobald sich Design/Spiele/Code/Daten
 *     ändern. Der Browser erkennt die neue sw.js (Byte-Diff), installiert
 *     sie im Hintergrund. War Offline-Modus aktiv, wird sofort der neue
 *     Stand komplett vorgecacht (alter Cache bleibt bis zur Aktivierung
 *     unangetastet). pwa-helper.js zeigt daraufhin das Update-Banner;
 *     erst nach Klick auf "Aktualisieren" schickt die Seite ein
 *     SKIP_WAITING an diesen Worker. activate() räumt danach alte
 *     Versions-Caches auf (das Flag bleibt erhalten) und übernimmt.
 *
 * Lokale Daten (Spieler-Roster, Favoriten, Einstellungen, eigene
 * Kategorien) laufen komplett über localStorage (siehe storage.js) und
 * sind von alldem hier unabhängig – die bleiben so oder so auf dem Gerät,
 * ob mit oder ohne installierter PWA, und werden von "Cache löschen" nie
 * angerührt.
 */

const APP_VERSION = "3.0.0";
const CACHE_NAME = `anna-cache-${APP_VERSION}`;

// Versionsunabhängiger Marker: NICHT umbenennen und NICHT in CACHE_NAME
// einbauen, sonst geht die "wurde diese PWA schon mal offline benutzt"-
// Information bei jedem Update verloren und jede Version müsste den
// Offline-Modus erneut manuell "aktivieren".
const FLAG_CACHE = "anna-offline-flag";
const FLAG_KEY = "/__offline_enabled__";

importScripts("/js/game-registry.js");

const CORE_ASSETS = [
  "/",
  "/settings",
  "/manifest.json",
  "/css/material.css",
  "/css/components.css",
  "/css/main.css",
  "/js/storage.js",
  "/js/icons.js",
  "/js/player-picker.js",
  "/js/category-picker.js",
  "/js/game-registry.js",
  "/js/app.js",
  "/js/settings.js",
  "/js/wake-lock.js",
  "/js/audio.js",
  "/js/pwa-helper.js",
  "/js/ripple.js",
  "/js/toast.js",
  "/js/view-nav.js",
  "/js/cache-tools.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-192-maskable.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/icon-512-maskable.png",
];

const GAME_ASSETS = (self.GAMES || []).flatMap((game) => [`/${game.id}`, ...game.assets]);

const PRECACHE_URLS = [...CORE_ASSETS, ...GAME_ASSETS];

async function isOfflineEnabled() {
  const cache = await caches.open(FLAG_CACHE);
  const match = await cache.match(FLAG_KEY);
  return Boolean(match);
}

// cache.addAll() bricht beim ERSTEN fehlgeschlagenen Request komplett ab –
// dann würde die ganze Installation (und damit das Update-Banner) lautlos
// nie erscheinen, nur weil eine einzelne Datei kurz nicht erreichbar war.
// Stattdessen jede Datei einzeln versuchen, damit ein Ausreißer nie das
// gesamte Update blockiert.
async function precacheAll(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        // Cache-Busting über Version: zwingt CDN/Cloudflare, die Datei neu vom Server zu holen
        const separator = url.includes("?") ? "&" : "?";
        const cleanUrl = url.split("#")[0];
        const cacheBustUrl = `${cleanUrl}${separator}cb=${APP_VERSION}`;

        const response = await fetch(cacheBustUrl, { cache: "no-store" });
        if (response.ok) {
          // Wir speichern das Asset unter dem Original-URL-Pfad (ohne query param),
          // damit der Cache-Match bei normalen Seitenzugriffen wie gewohnt funktioniert.
          await cache.put(url, response);
        }
      } catch (err) {
        // Einzelner Asset-Fehler darf das Update nicht blockieren; der
        // Fetch-Handler unten holt fehlende Dateien bei Bedarf nach
        // (sofern Offline-Modus aktiv ist).
      }
    })
  );
}

// Wird von der Seite per postMessage ausgelöst, sobald sie im PWA-
// Standalone-Modus läuft. Setzt das dauerhafte Flag und füllt den Cache.
// Idempotent/gefahrlos mehrfach aufrufbar (z.B. bei jedem App-Start).
async function enableOfflineMode() {
  const flagCache = await caches.open(FLAG_CACHE);
  await flagCache.put(FLAG_KEY, new Response("1"));

  const cache = await caches.open(CACHE_NAME);
  await precacheAll(cache, PRECACHE_URLS);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const existingCacheNames = await caches.keys();
      // Erkennt einen fremden/älteren Service Worker (z.B. von einer
      // komplett anderen Vorgänger-Version dieser App unter derselben
      // Origin), der sonst unbegrenzt weiter alte Dateien ausliefern
      // würde, ohne dass eine Nutzer-Bestätigung möglich ist. Nur wenn
      // NOCH KEIN "anna-cache-*" existiert, wird sofort übernommen
      // (einmalige Migration). Ab dann greift wieder die normale
      // Update-Bestätigung über das Banner (siehe Kommentar oben).
      const isFirstAnnaInstall = !existingCacheNames.some((name) => name.startsWith("anna-cache-"));

      // Nur vorcachen, wenn dieses Gerät den Offline-Modus schon mal
      // aktiviert hat (also mindestens einmal als installierte PWA lief).
      // Reine Browser-Tab-Nutzer bekommen hier NICHTS gecacht.
      if (await isOfflineEnabled()) {
        const cache = await caches.open(CACHE_NAME);
        await precacheAll(cache, PRECACHE_URLS);
      }

      if (isFirstAnnaInstall) self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // FLAG_CACHE bewusst NICHT löschen – das ist kein Versions-Cache,
      // sondern die dauerhafte "wurde als PWA benutzt"-Markierung.
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== FLAG_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();

      const clients = await self.clients.matchAll();
      clients.forEach((client) => client.postMessage({ type: "SW_ACTIVATED" }));
    })()
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "ENABLE_OFFLINE_CACHE") {
    event.waitUntil(enableOfflineMode());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    (async () => {
      // Reiner Browser-Tab, der die PWA nie "aktiviert" hat: 1:1 ans Netz
      // durchreichen, nichts lesen/schreiben. Genau das sorgt dafür, dass
      // normale Browser-Nutzung immer eine Internetverbindung braucht.
      if (!(await isOfflineEnabled())) {
        return fetch(request);
      }

      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })()
  );
});
