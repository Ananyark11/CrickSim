// CrickSim service worker — offline app shell + runtime asset cache.
// Bump CACHE when shipping changes so clients pick up the new build.
const CACHE = "cricksim-v3";
const CORE = [
  "/", "/index.html",
  "/terms", "/privacy",
  "/css/style.css", "/css/fonts.css",
  "/js/data.js", "/js/game.js", "/js/ui.js", "/js/pwa.js", "/js/vendor/gsap.min.js",
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

  // Navigations: network-first (fresh), fall back to the cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }
  // Assets (css/js/fonts/icons): cache-first, then network — and cache what we fetch,
  // so the first online visit makes every asset available fully offline afterwards.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit)
    )
  );
});
