// Service Worker registration utility
export const registerServiceWorker =
  async (): Promise<ServiceWorkerRegistration | null> => {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log(
          "Weather App: Service Worker registered successfully:",
          registration.scope
        );

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New service worker installed, notify user
                console.log("Weather App: New version available");
                notifyUpdate();
              }
            });
          }
        });

        return registration;
      } catch (error) {
        console.error(
          "Weather App: Service Worker registration failed:",
          error
        );
        return null;
      }
    } else {
      console.log("Weather App: Service Worker not supported");
      return null;
    }
  };

// Unregister service worker
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const result = await registration.unregister();
        console.log("Weather App: Service Worker unregistered:", result);
        return result;
      }
    } catch (error) {
      console.error(
        "Weather App: Service Worker unregistration failed:",
        error
      );
    }
  }
  return false;
};

// Check if app is running from cache (offline)
export const isAppCached = (): boolean => {
  return (
    "serviceWorker" in navigator && navigator.serviceWorker.controller !== null
  );
};

// Request background sync
export const requestBackgroundSync = async (tag: string): Promise<void> => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // Background sync is experimental - fallback gracefully
      if ("sync" in registration) {
        await (
          registration as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> };
          }
        ).sync.register(tag);
        console.log("Weather App: Background sync requested:", tag);
      } else {
        console.log("Weather App: Background sync not supported");
      }
    } catch (error) {
      console.error("Weather App: Background sync request failed:", error);
    }
  }
};

// Clear weather cache
export const clearWeatherCache = async (): Promise<void> => {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "CLEAR_WEATHER_CACHE",
    });
  }
};

// Get cache status
export const getCacheStatus = async (): Promise<{
  totalCached: number;
  cacheSize: number;
  lastUpdated: number;
} | null> => {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker.controller!.postMessage(
        { type: "GET_CACHE_STATUS" },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }
  return null;
};

// Subscribe to push notifications
export const subscribeToPushNotifications =
  async (): Promise<PushSubscription | null> => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        const registration = await navigator.serviceWorker.ready;

        // Check if already subscribed
        const existingSubscription =
          await registration.pushManager.getSubscription();
        if (existingSubscription) {
          return existingSubscription;
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.log("Weather App: Notification permission denied");
          return null;
        }

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY // You'll need to set this
        });

        console.log("Weather App: Push subscription created");
        return subscription;
      } catch (error) {
        console.error("Weather App: Push subscription failed:", error);
        return null;
      }
    }
    return null;
  };

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async (): Promise<boolean> => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const result = await subscription.unsubscribe();
        console.log("Weather App: Push unsubscribed:", result);
        return result;
      }
    } catch (error) {
      console.error("Weather App: Push unsubscription failed:", error);
    }
  }
  return false;
};

// Check network status
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Listen for online/offline events
export const addNetworkListener = (
  callback: (online: boolean) => void
): (() => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
};

// Notify user of app update
const notifyUpdate = (): void => {
  // You can customize this notification
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Weather App Update", {
      body: "A new version of the Weather App is available. Refresh to update.",
      icon: "/weather-icon-192.png",
      tag: "app-update",
    });
  } else {
    // Fallback to console log or custom UI notification
    console.log("Weather App: New version available - please refresh");
  }
};

// Install prompt handling for PWA
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const setupInstallPrompt = (): void => {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log("Weather App: Install prompt available");
  });
};

export const showInstallPrompt = async (): Promise<boolean> => {
  if (deferredPrompt) {
    // Show the prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    console.log("Weather App: Install prompt outcome:", outcome);

    // Clear the deferred prompt
    deferredPrompt = null;

    return outcome === "accepted";
  }
  return false;
};

export const isInstallPromptAvailable = (): boolean => {
  return deferredPrompt !== null;
};
