/*
 * Weather Pro service worker — hand written, no Workbox.
 *
 * Bump CACHE_VERSION whenever the caching contract changes (a new cache, a new
 * strategy, a precache entry that moved) or whenever a precached file's
 * *contents* change — the shell is keyed by path, not by hash, so a new
 * index.html would otherwise sit behind the old cached copy until a successful
 * online navigation replaced it. v3 carries index.html's colour-scheme init
 * script. `activate` deletes every cache not in CURRENT_CACHES, so the bump is
 * also the cleanup.
 */
const CACHE_VERSION = "v3";

const SHELL_CACHE = `weather-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `weather-assets-${CACHE_VERSION}`;
const API_CACHE = `weather-api-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, API_CACHE];

/*
 * Only paths that survive a rebuild belong here. Vite emits hashed filenames
 * (`/assets/index-Bzwz5YgB.js`), so build output is cached at runtime by the
 * `/assets/` rule below instead. A hand-written list of bundle paths is exactly
 * the bug this file used to have: it precached the Create-React-App paths
 * `/static/js/bundle.js` and `/static/css/main.css`, which never existed here.
 */
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  OFFLINE_URL,
  "/icons/weather-icon.svg",
  "/icons/weather-icon-maskable.svg",
];

/** Hosts whose GET responses are worth keeping for offline use. */
const API_HOSTS = new Set([
  "api.open-meteo.com",
  "marine-api.open-meteo.com",
  "archive-api.open-meteo.com",
  "air-quality-api.open-meteo.com",
  "geocoding-api.open-meteo.com",
  "flood-api.open-meteo.com",
  "nominatim.openstreetmap.org",
]);

/** Below this age a cached API response is served instantly and refreshed behind the user. */
const API_FRESH_MS = 30 * 60 * 1000;
/** Rough ceiling on API cache entries; the oldest are evicted first. */
const API_MAX_ENTRIES = 80;
/** How long a navigation waits for the network before falling back to the cached shell. */
const NAVIGATION_TIMEOUT_MS = 4000;

/** Epoch-ms stamp written onto every cached API response so the UI can age it. */
const TIMESTAMP_HEADER = "x-cached-at";
/** HIT-FRESH / HIT-STALE / MISS, set on the response the page actually receives. */
const CACHE_STATUS_HEADER = "x-cache";
/** Age of that body in whole seconds. */
const CACHE_AGE_HEADER = "x-cache-age";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is atomic: if any URL 404s the install rejects and the worker
      // never activates. That is deliberate. The previous version caught and
      // logged the failure, which is how it shipped two non-existent paths
      // without anyone noticing until they were offline.
      await cache.addAll(PRECACHE_URLS);
    })()
  );

  // No skipWaiting() here, on purpose. A new worker stays in "waiting" until
  // the user accepts the update (UpdatePrompt posts SKIP_WAITING), so a page
  // that is already running never has its hashed assets swapped underneath it.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("weather-") && !CURRENT_CACHES.includes(name)
          )
          .map((name) => caches.delete(name))
      );

      // claim() so the very first install controls the page that installed it.
      // Without it the first visit runs uncontrolled and nothing is cached
      // until a reload, making the app offline-capable only on the second
      // visit. On an update it changes nothing, because activation only
      // happens after the user asked for it.
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 1. Navigations: network-first, cached shell as the fallback.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // 2. Weather / geocoding APIs: stale-while-revalidate with a max-age.
  if (API_HOSTS.has(url.hostname)) {
    event.respondWith(handleApiRequest(event));
    return;
  }

  if (url.origin === self.location.origin) {
    // 3. Hashed build output: cache-first, immutable by construction.
    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(handleAssetRequest(request));
      return;
    }

    // 4. Everything else we serve ourselves (icons, manifest, favicon).
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // 5. Other cross-origin traffic (map tiles, third-party fonts) goes straight
  // to the network, uncached: tiles are unbounded in count and would grow the
  // cache past any size limit this file can honestly enforce.
});

/**
 * Network-first, because index.html names the hashed asset files: serving a
 * stale shell can point the browser at bundles this deployment no longer has.
 * The timeout keeps a dead-but-not-yet-failed connection from hanging the app.
 */
async function handleNavigationRequest(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    if (response.ok) {
      await cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    const shell = (await cache.match("/index.html")) || (await cache.match("/"));
    if (shell) return shell;

    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;

    // Last resort: never hand the user the browser's error page.
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>Weather Pro is offline</title>" +
        "<p>Weather Pro is offline and has nothing cached yet.</p>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}

/** Cache-first. A hashed filename can only ever mean one body. */
async function handleAssetRequest(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

/** Stale-while-revalidate: instant from cache, refreshed for next time. */
async function handleStaticRequest(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const response = await network;
  if (response) return response;

  return new Response("", { status: 504, statusText: "Offline" });
}

/**
 * Stale-while-revalidate with a max-age:
 *  - fresh cache (< API_FRESH_MS) -> served instantly, refreshed in the background
 *  - stale cache                  -> network first, the stale body if the network fails
 *  - no cache                     -> network, or an honest 503 JSON body offline
 *
 * Error responses are never written to the cache, so a 400 from a bad query
 * cannot poison the offline copy of a forecast.
 */
async function handleApiRequest(event) {
  const request = event.request;
  const cache = await caches.open(API_CACHE);
  const key = apiCacheKey(request);

  const cached = await cache.match(key);
  const cachedAt = cached
    ? Number(cached.headers.get(TIMESTAMP_HEADER)) || 0
    : 0;
  const age = cachedAt ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;

  const revalidate = async () => {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(key, await stampResponse(response, Date.now()));
      await trimCache(cache, API_MAX_ENTRIES);
    }
    return response;
  };

  if (cached && age < API_FRESH_MS) {
    event.waitUntil(revalidate().catch(() => undefined));
    return markCacheHit(cached, age, "HIT-FRESH");
  }

  try {
    const response = await revalidate();
    // A server-side failure is worth papering over with stale data; a 4xx is
    // the app asking the wrong question and must reach the caller intact.
    if (!response.ok && cached && response.status >= 500) {
      return markCacheHit(cached, age, "HIT-STALE");
    }
    return response;
  } catch {
    if (cached) {
      return markCacheHit(cached, age, "HIT-STALE");
    }
    return new Response(
      JSON.stringify({
        error: "offline",
        message:
          "No cached data for this request and the network is unavailable.",
        offline: true,
        url: request.url,
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          [CACHE_STATUS_HEADER]: "MISS",
        },
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The cache key is the request URL with cache-busting parameters removed and
 * the rest sorted, so `?latitude=1&longitude=2` and `?longitude=2&latitude=1`
 * are one entry. It stays a real, fetchable URL — background sync re-fetches
 * these keys directly. (The old key collapsed every request for a coordinate
 * onto one entry, so a marine and a forecast query overwrote each other.)
 */
function apiCacheKey(request) {
  const url = new URL(request.url);
  ["_", "t", "timestamp"].forEach((param) => url.searchParams.delete(param));
  url.searchParams.sort();
  return new Request(url.toString(), { method: "GET" });
}

/** Store the body verbatim, with the time it was stored bolted onto the headers. */
async function stampResponse(response, cachedAt) {
  const body = await response.clone().arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set(TIMESTAMP_HEADER, String(cachedAt));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Tell the caller it got a cached body and how old it is. */
function markCacheHit(response, age, status) {
  const headers = new Headers(response.headers);
  headers.set(CACHE_STATUS_HEADER, status);
  if (Number.isFinite(age)) {
    headers.set(CACHE_AGE_HEADER, String(Math.round(age / 1000)));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** cache.keys() is insertion-ordered, so the front of the list is the oldest. */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key))
  );
}

// ---------------------------------------------------------------------------
// Background sync — refresh what is already cached when the network returns
// ---------------------------------------------------------------------------

self.addEventListener("sync", (event) => {
  if (event.tag === "weather-sync") {
    event.waitUntil(syncWeatherData());
  }
});

async function syncWeatherData() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();

  await Promise.all(
    keys.map(async (key) => {
      try {
        const fresh = await fetch(key);
        if (fresh.ok) {
          await cache.put(key, await stampResponse(fresh, Date.now()));
        }
      } catch {
        // Still offline for this entry; the next sync will try again.
      }
    })
  );
}

// ---------------------------------------------------------------------------
// Notifications — the delivery mechanism for an Alert the user opted into
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Weather Pro", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Weather Pro", {
      body: payload.body,
      icon: "/icons/weather-icon.svg",
      badge: "/icons/weather-icon.svg",
      data: payload.url || "/",
      tag: payload.tag,
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const target = event.notification.data || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) => "focus" in client);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});

// ---------------------------------------------------------------------------
// Messages from the page
// ---------------------------------------------------------------------------

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (!type) return;

  if (type === "SKIP_WAITING") {
    // The user accepted the update in UpdatePrompt; take over now.
    self.skipWaiting();
    return;
  }

  if (type === "CLEAR_WEATHER_CACHE") {
    event.waitUntil(
      caches.delete(API_CACHE).then(() => reply(event, { cleared: true }))
    );
    return;
  }

  if (type === "GET_CACHE_STATUS") {
    event.waitUntil(getCacheStatus().then((status) => reply(event, status)));
    return;
  }

  if (type === "GET_VERSION") {
    reply(event, { version: CACHE_VERSION, caches: CURRENT_CACHES });
  }
});

function reply(event, payload) {
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(payload);
  }
}

async function getCacheStatus() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();

  let cacheSize = 0;
  let lastUpdated = 0;

  for (const key of keys) {
    const response = await cache.match(key);
    if (!response) continue;

    const stamp = Number(response.headers.get(TIMESTAMP_HEADER)) || 0;
    if (stamp > lastUpdated) lastUpdated = stamp;

    const body = await response.clone().arrayBuffer();
    cacheSize += body.byteLength;
  }

  return {
    totalCached: keys.length,
    cacheSize,
    lastUpdated,
    version: CACHE_VERSION,
  };
}
