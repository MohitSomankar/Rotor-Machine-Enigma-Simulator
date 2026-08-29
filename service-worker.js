// service-worker.js — caches the static shell so the Enigma engine + UI
// still load offline. Firestore (cloud sync) always needs real internet,
// so we deliberately do NOT touch network requests going to Google's CDN
// or Firestore — only our own local files are cached.

const CACHE_NAME = "secure-enigma-v2";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/rotor.js",
  "./js/reflector.js",
  "./js/plugboard.js",
  "./js/enigma.js",
  "./js/app.js",
  "./js/firebase.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for our own files.
  // Everything else (Firestore, gstatic Firebase SDK, etc.) passes straight
  // through to the network untouched.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
