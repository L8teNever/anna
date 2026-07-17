/**
 * Service Worker: Offline-Caching gibt es NUR für die installierte PWA
 * (Startbildschirm/App-Fenster im "standalone"-Modus) – ein normaler
 * Browser-Tab bleibt bewusst online-only. Der Worker selbst wird
 * trotzdem IMMER registriert (auch im Browser-Tab), weil Chrome/Edge
 * einen aktiven Service Worker mit fetch-Handler brauchen, damit der
 * native "App installieren"-Vorschlag überhaupt erscheint (sonst wäre
 * die App nie als PWA installierbar). Ob tatsächlich gecacht wird,
 * entscheidet dieser Worker selbst anhand eines dauerhaften, von der
 * Versionsnummer unabhängigen Flags (FLAG_CACHE) – siehe unten.
 *
 * WICHTIGER VORBEHALT (Web-Plattform-Grenze, kein Implementierungsfehler):
 * Cache Storage ist pro ORIGIN gültig, nicht pro Fenster/Tab. Es gibt
 * keine Browser-API, mit der ein Service Worker unterscheiden könnte,
 * ob eine einzelne Anfrage aus dem installierten App-Fenster oder einem
 * ganz normalen Browser-Tab kommt. Das bedeutet: sobald diese PWA auf
 * einem Gerät EINMAL im Standalone-Modus geöffnet wurde, "weiß" der
 * Worker das dauerhaft – öffnet danach jemand auf demselben Gerät
 * zusätzlich einen normalen Browser-Tab, sieht auch der isOfflineEnabled()
 * === true. Das lässt sich nicht sauber verhindern (ist keine Baustelle,
 * sondern eine Grenze der Plattform). Der fetch-Handler unten fängt den
 * SCHADEN daraus aber gezielt ab: er liefert IMMER zuerst das Netz (wer
 * Internet hat, bekommt IMMER den frischen Serverstand, nie einen
 * veralteten Cache-Stand vorgesetzt) und nutzt den Cache wirklich nur
 * als Fallback, wenn das Netz gerade nicht erreichbar ist. Ein normaler
 * Browser-Tab, der NIE auf einem Gerät mit aktivierter PWA lief, bleibt
 * dagegen zu 100% cachefrei (siehe erster Zweig im fetch-Handler).
 *
 * Ablauf:
 *  1. pwa-helper.js erkennt beim Laden, ob die Seite im PWA-Standalone-
 *     Modus läuft (display-mode: standalone/fullscreen/minimal-ui bzw.
 *     iOS navigator.standalone) und schickt in diesem Fall die Nachricht
 *     { type: "ENABLE_OFFLINE_CACHE" } an diesen Worker.
 *  2. enableOfflineMode() setzt daraufhin (einmalig – wiederholte Aufrufe
 *     sind ein günstiger No-Op) das Flag (bleibt über Neustarts des
 *     Workers UND über App-Updates hinweg erhalten, da es in einer
 *     eigenen, versionsunabhängigen Cache-Storage-"Datenbank" liegt) und
 *     lädt einmalig die komplette App in den Cache.
 *  3. Ab jetzt (und bei jedem künftigen install()) prüft dieser Worker das
 *     Flag: ist es gesetzt, wird bei JEDEM Update automatisch der
 *     komplette neue Stand vorab gecacht – ganz ohne dass die Seite die
 *     Nachricht erneut schicken muss. Ist es NICHT gesetzt (reiner
 *     Browser-Tab, nie als PWA geöffnet), bleibt der Worker ein reiner
 *     Passthrough: fetch-Anfragen gehen 1:1 ans Netz, nichts wird gecacht.
 *  4. APP_VERSION HIER IN DIESER DATEI (nicht nur in version.js!) hochzählen,
 *     sobald sich Design/Spiele/Code/Daten ändern – siehe ausführliche
 *     Begründung direkt bei der Konstante weiter unten. Der Browser erkennt
 *     die neue sw.js (Byte-Diff), installiert
 *     sie im Hintergrund. War Offline-Modus aktiv, wird sofort der neue
 *     Stand komplett vorgecacht (alter Cache bleibt bis zur Aktivierung
 *     unangetastet). pwa-helper.js zeigt daraufhin das Update-Banner;
 *     erst nach Klick auf "Aktualisieren" schickt die Seite ein
 *     SKIP_WAITING an diesen Worker. activate() räumt danach alte
 *     Versions-Caches auf (das Flag bleibt erhalten) und übernimmt – ein
 *     automatischer Seiten-Reload passiert dabei NUR, wenn die Seite beim
 *     Laden bereits von einem älteren Worker kontrolliert wurde (siehe
 *     hadControllerAtLoad in pwa-helper.js), nie beim allerersten Install.
 *
 * Lokale Daten (Spieler-Roster, Favoriten, Einstellungen, eigene
 * Kategorien) laufen komplett über localStorage (siehe storage.js) und
 * sind von alldem hier unabhängig – die bleiben so oder so auf dem Gerät,
 * ob mit oder ohne installierter PWA, und werden von "Cache löschen" nie
 * angerührt.
 */

// WICHTIG – Kernstück des Selbstheilungs-Mechanismus: Der Browser erkennt
// ein Update AUSSCHLIESSLICH über einen Byte-Unterschied in DIESER Datei
// (sw.js) selbst. Dateien, die per importScripts() nachgeladen werden (wie
// früher version.js), zählen für diesen Vergleich NICHT mit! Stand die
// Versionsnummer nur dort (z.B. "const APP_VERSION = self.APP_VERSION"
// nach importScripts("/js/version.js")), konnte man sie dort beliebig oft
// hochzählen, ohne dass sw.js jemals andere Bytes bekam – der Browser hat
// dann NIE ein Update erkannt, und Geräte mit installierter PWA blieben
// für immer auf einem alten Stand hängen (unabhängig von allen Checks in
// pwa-helper.js – die können nur etwas melden, das der Browser überhaupt
// als "neu" registriert hat). Deshalb steht die Versionsnummer jetzt HIER
// zusätzlich als literaler String: bei JEDER Änderung – auch wenn nur
// andere Dateien wie game-registry.js sich geändert haben – MUSS dieser
// String mit hochgezählt werden (parallel zu version.js, das weiterhin die
// in den Einstellungen angezeigte Versionsnummer liefert), sonst bleibt
// sw.js byte-identisch und das gesamte Update-System bleibt wirkungslos.
const APP_VERSION = "3.12.3";
const CACHE_NAME = `anna-cache-${APP_VERSION}`;

// Versionsunabhängige Marker: NICHT umbenennen und NICHT in CACHE_NAME
// einbauen, sonst gehen diese Informationen bei jedem Update verloren.
const FLAG_CACHE = "anna-offline-flag";
// "Wurde Offline-Modus (PWA) schon mal aktiviert?" – steuert Precaching/fetch-Strategie.
const FLAG_KEY = "/__offline_enabled__";
// "Ist auf diesem Gerät/Origin schon irgendwann ein anna-Worker fertig
// installiert gewesen?" – unabhängig vom Offline-Status. Ersetzt die
// frühere (fehlerhafte) Prüfung "existiert ein anna-cache-*", die bei
// reinen Browser-Tab-Nutzern (die Offline-Modus nie aktivieren, siehe
// isOfflineEnabled) permanent falsch auf "true" stand und dadurch bei
// JEDEM Update erneut self.skipWaiting() ausgelöst hätte.
const MIGRATION_FLAG_KEY = "/__anna_sw_installed__";

importScripts("/js/game-registry.js");

const CORE_ASSETS = [
  "/",
  "/settings",
  "/manifest.json",
  "/css/material.css",
  "/css/components.css",
  "/css/main.css",
  "/js/version.js",
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
  "/js/confirm-dialog.js",
  "/js/touch-fixes.js",
  "/js/qrcode.js",
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
// Standalone-Modus läuft. Setzt das dauerhafte Flag und füllt den Cache
// EINMALIG – bei jedem weiteren Aufruf (z.B. bei jeder In-App-Navigation,
// da diese App aus mehreren echten Seiten statt einer SPA besteht) ist
// das Flag schon gesetzt und wir überspringen das erneute Vorcachen.
// Künftige Versions-Updates cachen trotzdem automatisch neu (siehe
// install()-Handler unten, der PRECACHE_URLS bei jedem Update erneut lädt).
async function enableOfflineMode() {
  if (await isOfflineEnabled()) return;

  const flagCache = await caches.open(FLAG_CACHE);
  await flagCache.put(FLAG_KEY, new Response("1"));

  const cache = await caches.open(CACHE_NAME);
  await precacheAll(cache, PRECACHE_URLS);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const flagCache = await caches.open(FLAG_CACHE);

      // Echte "einmalige Migration"-Erkennung: war dieser Worker auf
      // diesem Gerät/Origin schon mal fertig installiert (offline aktiv
      // oder nicht, spielt keine Rolle)? Nur beim GENUINEN allerersten
      // Install wird sofort übernommen (skipWaiting) – ab dann greift
      // immer die normale Update-Bestätigung über das Banner.
      const previouslyInstalled = await flagCache.match(MIGRATION_FLAG_KEY);
      const isFirstAnnaInstall = !previouslyInstalled;

      // Nur vorcachen, wenn dieses Gerät den Offline-Modus schon mal
      // aktiviert hat (also mindestens einmal als installierte PWA lief).
      // Reine Browser-Tab-Nutzer bekommen hier NICHTS gecacht.
      if (await isOfflineEnabled()) {
        const cache = await caches.open(CACHE_NAME);
        await precacheAll(cache, PRECACHE_URLS);
      }

      if (isFirstAnnaInstall) {
        await flagCache.put(MIGRATION_FLAG_KEY, new Response("1"));
        self.skipWaiting();
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // FLAG_CACHE bewusst NICHT löschen – das ist kein Versions-Cache,
      // sondern enthält die dauerhaften "wurde als PWA benutzt" / "wurde
      // hier schon mal installiert"-Markierungen.
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

      // Netzwerk-zuerst: wer Internet hat (App ODER ein Tab auf einem
      // Gerät, auf dem die PWA mal aktiviert wurde), bekommt IMMER den
      // frischen Serverstand – nie ungefragt eine veraltete Cache-Version.
      // Der Cache ist nur der Fallback, wenn das Netz wirklich nicht
      // erreichbar ist (= "richtiges" Offline-Spielen in der PWA).
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
