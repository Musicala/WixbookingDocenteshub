/* sw.js — Musicala Hub (PWA) — PRO (auto-update-friendly)
   Estrategia:
   - Precachéa SOLO lo esencial (HTML + manifest + icons + logo)
     (NO precachea app.js / styles.css para evitar “pegues” en iOS)
   - Navegación: Network-first con fallback offline a index.html
   - JS/CSS/manifest (same-origin): Network-first (para que se actualicen solos)
   - Otros same-origin assets: Stale-While-Revalidate
   - Limpieza de cachés viejos + mensajes para UI
*/

const BUILD = "2026-10-21.1"; // Sube la versión en cada despliegue para actualizar el service worker.
const VERSION = `v5-${BUILD}`;

const CACHE_STATIC  = `musicala-static`;   // sin versión para no acumular basura
const CACHE_RUNTIME = `musicala-runtime`;  // sin versión para no acumular basura

/**
 * Core assets: solo lo mínimo estable.
 * Importante: NO incluir app.js ni styles.css aquí.
 */
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* =========================
   Utils
========================= */
const isHttp = (url) => url.protocol === "http:" || url.protocol === "https:";
const isRangeRequest = (req) => req.headers && req.headers.has("range");

async function postToAllClients(payload) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage(payload);
}

async function safeCachePut(cache, request, response) {
  try {
    if (!response || response.status === 206) return; // Range
    if (response.type === "opaque") return;           // cross-origin opaque
    if (response.status >= 400) return;
    await cache.put(request, response);
  } catch (_) {}
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHTML(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

function isCriticalFreshAsset(url) {
  // Fuerza “siempre lo último” para estos, porque aquí es donde se queda pegado Safari.
  const p = url.pathname;
  return (
    p.endsWith("/app.js") ||
    p.endsWith("/styles.css") ||
    p.endsWith("/manifest.webmanifest")
  );
}

/* =========================
   Messages
========================= */
self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "GET_VERSION") {
    event.source?.postMessage({ type: "SW_VERSION", version: VERSION, build: BUILD });
  }

  if (data.type === "CLEAR_CACHES") {
    event.waitUntil((async () => {
      await caches.delete(CACHE_STATIC);
      await caches.delete(CACHE_RUNTIME);
      await postToAllClients({ type: "SW_CACHES_CLEARED" });
    })());
  }
});

/* =========================
   Install
========================= */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);

    // Importante: usamos fetch({cache:"reload"}) para saltar caché HTTP (Safari ama aferrarse).
    await Promise.allSettled(
      CORE_ASSETS.map(async (url) => {
        try {
          const req = new Request(url, { cache: "reload" });
          const res = await fetch(req);
          await safeCachePut(cache, url, res.clone());
        } catch (_) {}
      })
    );

    // Instalación rápida
    self.skipWaiting();
  })());
});

/* =========================
   Activate
========================= */
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Como los caches ya no van versionados, no hay que barrer por versiones antiguas.
    await self.clients.claim();
    await postToAllClients({ type: "SW_ACTIVATED", version: VERSION, build: BUILD });
  })());
});

/* =========================
   Fetch
========================= */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET
  if (req.method !== "GET") return;

  // Evita Range (media/video)
  if (isRangeRequest(req)) return;

  const url = new URL(req.url);
  if (!isHttp(url)) return;

  const sameOrigin = isSameOrigin(url);

  // ===== Navegación (HTML) =====
  if (isHTML(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(new Request(req, { cache: "no-store" }));
        const cache = await caches.open(CACHE_RUNTIME);
        await safeCachePut(cache, "./index.html", fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match("./index.html") || await caches.match("./");
        return cached || new Response("Sin conexión", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // ===== Same-origin =====
  if (sameOrigin) {
    // 1) JS/CSS/manifest: Network-first (auto-update)
    if (isCriticalFreshAsset(url)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_RUNTIME);
        try {
          // cache:"reload" evita quedarnos con el caché HTTP viejo
          const fresh = await fetch(new Request(req, { cache: "reload" }));
          await safeCachePut(cache, req, fresh.clone());
          return fresh;
        } catch (_) {
          const cached = await caches.match(req);
          return cached || new Response("", { status: 504 });
        }
      })());
      return;
    }

    // 2) Resto de assets same-origin: Stale-While-Revalidate
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: false });

      const fetchPromise = (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_RUNTIME);
          await safeCachePut(cache, req, fresh.clone());
          return fresh;
        } catch (_) {
          return null;
        }
      })();

      return cached || (await fetchPromise) || new Response("", { status: 504 });
    })());
    return;
  }

  // ===== Cross-origin =====
  // Passthrough (no cache externo).
});
