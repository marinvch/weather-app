const CACHE_NAME = "weather-app-v1";
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

// URLs to cache
const urlsToCache = [
  "/",
  "/static/js/bundle.js",
  "/static/css/main.css",
  "/manifest.json",
];

// Weather API patterns
const WEATHER_API_PATTERNS = [
  /https:\/\/api\.open-meteo\.com\/v1\/forecast/,
  /https:\/\/marine-api\.open-meteo\.com\/v1\/marine/,
  /https:\/\/api\.open-meteo\.com\/v1\/archive/,
];

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Weather App: Cache opened");
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error("Weather App: Cache installation failed:", error);
      })
  );
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Weather App: Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Check if this is a weather API request
  const isWeatherAPI = WEATHER_API_PATTERNS.some((pattern) =>
    pattern.test(url)
  );

  if (isWeatherAPI) {
    // Handle weather API requests with cache-first strategy
    event.respondWith(handleWeatherAPIRequest(event.request));
  } else {
    // Handle other requests with network-first strategy
    event.respondWith(handleGeneralRequest(event.request));
  }
});

async function handleWeatherAPIRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = createCacheKey(request);

  try {
    // Try to get fresh data from network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone the response before caching
      const responseToCache = networkResponse.clone();

      // Add timestamp to cached response
      const responseData = await responseToCache.json();
      const cachedData = {
        data: responseData,
        timestamp: Date.now(),
        url: request.url,
      };

      // Cache the response with timestamp
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(cachedData), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        })
      );

      console.log("Weather App: Cached fresh weather data for:", request.url);
      return networkResponse;
    }
  } catch (error) {
    console.log("Weather App: Network failed, trying cache for:", request.url);
  }

  // Network failed or unavailable, try cache
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const cachedData = await cachedResponse.json();
    const age = Date.now() - cachedData.timestamp;

    if (age < CACHE_EXPIRY) {
      console.log("Weather App: Serving fresh cached data for:", request.url);
      return new Response(JSON.stringify(cachedData.data), {
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "HIT-FRESH",
        },
      });
    } else {
      console.log("Weather App: Serving stale cached data for:", request.url);
      return new Response(JSON.stringify(cachedData.data), {
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "HIT-STALE",
        },
      });
    }
  }

  // No cache available, return offline response
  return new Response(
    JSON.stringify({
      error: "offline",
      message: "Weather data unavailable offline",
      offline: true,
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "MISS",
      },
    }
  );
}

async function handleGeneralRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // If successful, cache it for later
    if (networkResponse.ok && request.method === "GET") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log("Weather App: Serving cached resource:", request.url);
      return cachedResponse;
    }

    // No cache available
    throw error;
  }
}

function createCacheKey(request) {
  const url = new URL(request.url);

  // Remove timestamp-like parameters that change frequently
  url.searchParams.delete("_");
  url.searchParams.delete("timestamp");
  url.searchParams.delete("t");

  // Create a simplified cache key based on main parameters
  const latitude = url.searchParams.get("latitude");
  const longitude = url.searchParams.get("longitude");
  const endpoint = url.pathname;

  return `weather-${endpoint}-${latitude}-${longitude}`;
}

// Background sync for when connection is restored
self.addEventListener("sync", (event) => {
  if (event.tag === "weather-sync") {
    event.waitUntil(syncWeatherData());
  }
});

async function syncWeatherData() {
  console.log("Weather App: Background sync triggered");

  // Get stored locations that need updates
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();

  // Refresh cached weather data
  for (const request of keys) {
    if (WEATHER_API_PATTERNS.some((pattern) => pattern.test(request.url))) {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) {
          await cache.put(request, fresh);
          console.log("Weather App: Synced data for:", request.url);
        }
      } catch (error) {
        console.log("Weather App: Sync failed for:", request.url);
      }
    }
  }
}

// Push notifications for weather alerts
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: "/weather-icon-192.png",
      badge: "/weather-badge-72.png",
      data: data.url,
      actions: [
        {
          action: "view",
          title: "View Weather",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "view") {
    event.waitUntil(clients.openWindow(event.notification.data || "/"));
  }
});

// Message handling for cache management
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_WEATHER_CACHE") {
    event.waitUntil(clearWeatherCache());
  } else if (event.data && event.data.type === "GET_CACHE_STATUS") {
    event.waitUntil(
      getCacheStatus().then((status) => {
        event.ports[0].postMessage(status);
      })
    );
  }
});

async function clearWeatherCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();

  for (const request of keys) {
    if (WEATHER_API_PATTERNS.some((pattern) => pattern.test(request.url))) {
      await cache.delete(request);
    }
  }

  console.log("Weather App: Weather cache cleared");
}

async function getCacheStatus() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();

  const weatherCaches = keys.filter((request) =>
    WEATHER_API_PATTERNS.some((pattern) => pattern.test(request.url))
  );

  const status = {
    totalCached: weatherCaches.length,
    cacheSize: await getCacheSize(cache, weatherCaches),
    lastUpdated: await getLastCacheUpdate(cache, weatherCaches),
  };

  return status;
}

async function getCacheSize(cache, requests) {
  let totalSize = 0;

  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }

  return totalSize;
}

async function getLastCacheUpdate(cache, requests) {
  let lastUpdate = 0;

  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const data = await response.json();
      if (data.timestamp && data.timestamp > lastUpdate) {
        lastUpdate = data.timestamp;
      }
    }
  }

  return lastUpdate;
}
