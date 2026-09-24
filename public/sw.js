const STATIC_CACHE = "sass-pos-static-v2";
const OFFLINE_SHELL = "/offline.html";
const SAFE_ASSET_PATHS = new Set(["/pwa-icon.svg", "/favicon.ico"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("sass-pos-") && cacheName !== STATIC_CACHE)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isNavigation =
    request.mode === "navigate" && url.origin === self.location.origin && !url.pathname.startsWith("/api/");

  // Never cache rendered routes. A network failure may show only this static,
  // data-free shell; it must not expose an authenticated page or API response.
  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(STATIC_CACHE).then(async (cache) => {
          const offlineShell = await cache.match(OFFLINE_SHELL);
          return offlineShell ?? new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        }),
      ),
    );
    return;
  }

  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || SAFE_ASSET_PATHS.has(url.pathname));
  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
