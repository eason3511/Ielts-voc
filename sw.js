/* IELTS Master — offline cache service worker
   Strategy: cache-first for instant reopens, with a background revalidation
   so the NEXT launch always has the latest version once one succeeds while
   online. Everything lives in this single index.html, so there is exactly
   one asset to manage. */
const CACHE_VERSION = "ielts-master-v1";
const APP_SHELL_URL = "./index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.add(APP_SHELL_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Only handle same-origin navigation/document requests for the app shell —
  // this is a single-file app, so that's the one thing worth caching.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const networkFetch = fetch(req)
        .then((fresh) => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, fresh.clone()));
          }
          return fresh;
        })
        .catch(() => cached); // offline: fall back to whatever is cached

      // cache-first: serve instantly if we have it, refresh in the background;
      // if nothing is cached yet (first ever visit), wait on the network.
      return cached || networkFetch;
    })
  );
});
