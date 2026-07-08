// CrickSim service worker — offline app shell + runtime asset cache.
// Bump CACHE when shipping changes so clients pick up the new build.
const CACHE = "cricksim-v4";
const CORE = [
  "/", "/index.html",
  "/terms", "/privacy",
  "/css/style.css", "/css/fonts.css",
  "/js/boot.js", "/js/data.js", "/js/game.js", "/js/ui.js", "/js/pwa.js", "/js/vendor/gsap.min.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // everything is same-origin now

  // Navigations AND code (JS/CSS/manifest): network-first, updating the cache on
  // every successful fetch. This guarantees a new deploy is served *whole* — the
  // HTML and its scripts/styles always come from the same version, never a stale
  // mix. Falls back to cache (then the app shell) only when the network fails.
  const isCode = /\.(?:js|css|webmanifest)$/.test(url.pathname);
  if (req.mode === "navigate" || isCode) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html")))
    );
    return;
  }
  // Static assets (fonts, icons, images): cache-first — they're effectively
  // immutable, so serve instantly and fill the cache on first fetch.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit)
    )
  );
});
