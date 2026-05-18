const CACHE_NAME = "certchain-static-v2";
const LAST_CERT_URL = "/last-verified-cert.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/admin/login", "/offline-fallback.html"]).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "CACHE_LAST_CERT") return;
  const payload = JSON.stringify(event.data.payload || {});
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.put(
        LAST_CERT_URL,
        new Response(payload, {
          headers: { "Content-Type": "application/json" },
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname === LAST_CERT_URL) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(LAST_CERT_URL))
        .then((cached) => cached || new Response("{}", { status: 200 }))
    );
    return;
  }

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match("/offline-fallback.html");
          }
          return new Response("Offline", { status: 503 });
        })
      )
  );
});
