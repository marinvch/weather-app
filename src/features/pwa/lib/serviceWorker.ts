/**
 * The page's half of the service worker contract in `public/sw.js`.
 *
 * Everything here is a no-op when `navigator.serviceWorker` is missing, which
 * is also the case under jsdom — the test suite can exercise the callers, it
 * just never sees a registration.
 */

export interface CacheStatus {
  totalCached: number;
  cacheSize: number;
  lastUpdated: number;
  version?: string;
}

const SW_URL = "/sw.js";

const isSupported = (): boolean =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator;

// ---------------------------------------------------------------------------
// Registration and updates
// ---------------------------------------------------------------------------

type UpdateListener = (updateAvailable: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
const updateListeners = new Set<UpdateListener>();
/** Set once the user accepts an update, so `controllerchange` reloads exactly once. */
let reloadingForUpdate = false;
let controllerChangeBound = false;

const announceUpdate = (worker: ServiceWorker | null): void => {
  waitingWorker = worker;
  updateListeners.forEach((listener) => listener(worker !== null));
};

/** Subscribe to "a new version is waiting". Returns the unsubscribe function. */
export const onServiceWorkerUpdate = (listener: UpdateListener): (() => void) => {
  updateListeners.add(listener);
  // Fire immediately so a component that mounts after the worker landed still
  // learns about it.
  listener(waitingWorker !== null);
  return () => {
    updateListeners.delete(listener);
  };
};

export const isUpdateAvailable = (): boolean => waitingWorker !== null;

/**
 * Tell the waiting worker to take over, then reload once it has. The reload is
 * driven by `controllerchange` rather than fired straight away: reloading
 * before the new worker controls the page just re-runs the old one.
 */
export const applyServiceWorkerUpdate = (): void => {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }

  reloadingForUpdate = true;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
};

const trackWaitingWorker = (registration: ServiceWorkerRegistration): void => {
  // A worker can already be waiting when we register — e.g. the tab was open
  // when the new build was deployed and the user never reloaded.
  if (registration.waiting && navigator.serviceWorker.controller) {
    announceUpdate(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener("statechange", () => {
      if (installing.state !== "installed") return;

      if (navigator.serviceWorker.controller) {
        // There was a previous worker, so this is an update rather than the
        // first install: hold it until the user says go.
        announceUpdate(installing);
      }
    });
  });
};

export const registerServiceWorker =
  async (): Promise<ServiceWorkerRegistration | null> => {
    // `beforeinstallprompt` fires early and is never replayed, so the listener
    // has to exist before we await anything. setupInstallPrompt() is
    // idempotent, so a caller that also calls it directly is fine.
    setupInstallPrompt();

    if (!isSupported()) {
      return null;
    }

    // In dev, Vite serves unbundled modules from /src and /@vite; caching those
    // makes edits appear not to take. Any worker left over from a production
    // build on the same origin (localhost) is removed for the same reason.
    if (import.meta.env.DEV) {
      const existing = await navigator.serviceWorker.getRegistrations();
      await Promise.all(existing.map((registration) => registration.unregister()));
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: "/",
      });

      if (!controllerChangeBound) {
        controllerChangeBound = true;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!reloadingForUpdate) return;
          reloadingForUpdate = false;
          window.location.reload();
        });
      }

      trackWaitingWorker(registration);

      // Browsers only check for a new worker on navigation; a long-lived tab
      // would never notice a deploy otherwise.
      window.addEventListener("focus", () => {
        registration.update().catch(() => undefined);
      });

      return registration;
    } catch (error) {
      console.error("Weather App: Service Worker registration failed:", error);
      return null;
    }
  };

export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (!isSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return await registration.unregister();
    }
  } catch (error) {
    console.error("Weather App: Service Worker unregistration failed:", error);
  }
  return false;
};

/** True once a worker controls this page — i.e. offline support is live. */
export const isAppCached = (): boolean =>
  isSupported() && navigator.serviceWorker.controller !== null;

// ---------------------------------------------------------------------------
// Talking to the active worker
// ---------------------------------------------------------------------------

/** Round-trip a message to the worker over a MessageChannel, or resolve null. */
const askWorker = <T>(type: string, timeoutMs = 5000): Promise<T | null> => {
  if (!isSupported() || !navigator.serviceWorker.controller) {
    return Promise.resolve(null);
  }

  return new Promise<T | null>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);

    channel.port1.onmessage = (event: MessageEvent<T>) => {
      clearTimeout(timer);
      resolve(event.data);
    };

    navigator.serviceWorker.controller?.postMessage({ type }, [channel.port2]);
  });
};

export const getCacheStatus = (): Promise<CacheStatus | null> =>
  askWorker<CacheStatus>("GET_CACHE_STATUS");

export const clearWeatherCache = async (): Promise<void> => {
  await askWorker<{ cleared: boolean }>("CLEAR_WEATHER_CACHE");
};

export const getServiceWorkerVersion = (): Promise<{
  version: string;
  caches: string[];
} | null> => askWorker("GET_VERSION");

export const requestBackgroundSync = async (tag: string): Promise<void> => {
  if (!isSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    // Background sync is not in every browser and not in the DOM lib types.
    if ("sync" in registration) {
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        }
      ).sync.register(tag);
    }
  } catch (error) {
    console.error("Weather App: Background sync request failed:", error);
  }
};

// ---------------------------------------------------------------------------
// Push — the delivery mechanism for an Alert the user opted into
// ---------------------------------------------------------------------------

export const subscribeToPushNotifications =
  async (): Promise<PushSubscription | null> => {
    if (!isSupported() || !("PushManager" in window)) return null;

    try {
      const registration = await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) return existing;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return null;

      return await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // applicationServerKey belongs here once a VAPID key exists; there is
        // no backend yet, so subscriptions are local-only.
      });
    } catch (error) {
      console.error("Weather App: Push subscription failed:", error);
      return null;
    }
  };

export const unsubscribeFromPushNotifications = async (): Promise<boolean> => {
  if (!isSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return await subscription.unsubscribe();
    }
  } catch (error) {
    console.error("Weather App: Push unsubscription failed:", error);
  }
  return false;
};

// ---------------------------------------------------------------------------
// Network status
// ---------------------------------------------------------------------------

export const isOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export const addNetworkListener = (
  callback: (online: boolean) => void
): (() => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
};

// ---------------------------------------------------------------------------
// Install prompt
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type InstallListener = (canInstall: boolean) => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<InstallListener>();
let installPromptBound = false;

const announceInstallAvailability = (): void => {
  installListeners.forEach((listener) => listener(deferredPrompt !== null));
};

/**
 * Capture `beforeinstallprompt` before the browser discards it. Call this once,
 * as early as possible — the event fires during load and is not replayed.
 */
export const setupInstallPrompt = (): void => {
  if (installPromptBound || typeof window === "undefined") return;
  installPromptBound = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress the browser's own mini-infobar; InstallPrompt asks instead.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    announceInstallAvailability();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    announceInstallAvailability();
  });
};

/** Subscribe to install availability. Returns the unsubscribe function. */
export const onInstallAvailabilityChange = (
  listener: InstallListener
): (() => void) => {
  installListeners.add(listener);
  listener(deferredPrompt !== null);
  return () => {
    installListeners.delete(listener);
  };
};

export const isInstallPromptAvailable = (): boolean => deferredPrompt !== null;

/** True when the app is already running as an installed PWA. */
export const isAppInstalled = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    // iOS Safari predates display-mode and reports this instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export const showInstallPrompt = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  // The event is single-use whatever the user chose.
  deferredPrompt = null;
  announceInstallAvailability();

  return outcome === "accepted";
};
