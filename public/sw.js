// Hand-rolled, dependency-free service worker. TanStack Start's build pipeline
// (nitro, targeting cloudflare) doesn't have a clean integration point for a
// workbox-style build-time precache manifest, so this takes a simpler runtime
// approach instead: cache static assets and pages as they're actually
// requested, rather than precaching a fingerprinted file list.
//
// Bump CACHE_VERSION on any change to this file's caching behavior — it's
// what triggers old caches to be cleared on the next activate.
const CACHE_VERSION = "v1";
const CACHE_NAME = `syncly-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [OFFLINE_URL, "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept mutations / server fns
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let Supabase/Mapbox/etc hit the network directly

  // HTML navigations: network-first, falling back to a cached copy of the
  // same URL, then to the offline page — keeps content fresh online and
  // still renders something coherent offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Static assets (Vite's fingerprinted JS/CSS/images/fonts): stale-while-
  // revalidate. Fingerprinted filenames mean a cached entry is never stale
  // in a way that matters — a new build ships new filenames — so serving
  // cache-first here is what makes repeat loads fast.
  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached ?? network;
        }),
      ),
    );
    return;
  }

  // Everything else same-origin (JSON, misc GET): network-first with a
  // cache fallback for offline resilience.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
