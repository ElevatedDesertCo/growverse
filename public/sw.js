// Growverse service worker — minimal, just enough to satisfy PWA install
// criteria and make the game open instantly from the home-screen icon.
const CACHE = "growverse-v1";

// Static assets that are safe to pre-cache. Hashed Next.js JS/CSS bundles
// are NOT listed here — they change on every deploy. Those use the
// network-first fallback below.
const PRECACHE = [
  "/",
  "/brand/growverse-splash.png",
  "/buildings/grow-tent.png",
  "/buildings/bloom-extractor.png",
  "/buildings/amber-forge.png",
  "/buildings/thorn-trap.png",
  "/icons/leaf.png",
  "/icons/fire.png",
  "/icons/mushroom.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch((err) =>
              console.warn(`[sw] precache failed: ${url}`, err),
            ),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first for everything. Fall back to cache so the game still
// loads when offline. Only GET requests are cacheable.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Skip Next.js HMR + RSC streaming during dev (no-op in production)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for the next offline open.
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
