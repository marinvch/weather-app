import { useState, useEffect, useCallback } from "react";
import {
  isOnline,
  addNetworkListener,
  getCacheStatus,
  clearWeatherCache,
  requestBackgroundSync,
  isAppCached,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isInstallPromptAvailable,
  showInstallPrompt,
} from '@/features/pwa/lib/serviceWorker';

interface CacheStatus {
  totalCached: number;
  cacheSize: number;
  lastUpdated: number;
}

interface OfflineHookReturn {
  // Network status
  isOnline: boolean;
  isOffline: boolean;

  // Cache management
  cacheStatus: CacheStatus | null;
  clearCache: () => Promise<void>;
  refreshCacheStatus: () => Promise<void>;

  // Service worker status
  isServiceWorkerActive: boolean;
  requestSync: (tag?: string) => Promise<void>;

  // Push notifications
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;

  // PWA installation
  canInstall: boolean;
  promptInstall: () => Promise<boolean>;

  // Utility functions
  formatCacheSize: (bytes: number) => string;
  formatLastUpdated: (timestamp: number) => string;
}

export const useOffline = (): OfflineHookReturn => {
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [isServiceWorkerActive, setIsServiceWorkerActive] = useState(
    isAppCached()
  );
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [canInstall, setCanInstall] = useState(isInstallPromptAvailable());

  // Network status monitoring
  useEffect(() => {
    const cleanup = addNetworkListener((online) => {
      setIsOnlineState(online);

      // Request background sync when coming back online
      if (online && isServiceWorkerActive) {
        requestBackgroundSync("weather-sync").catch(console.error);
      }
    });

    return cleanup;
  }, [isServiceWorkerActive]);

  // Service worker status monitoring
  useEffect(() => {
    const checkServiceWorker = () => {
      setIsServiceWorkerActive(isAppCached());
    };

    // Check initially
    checkServiceWorker();

    // Check when service worker updates
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        checkServiceWorker
      );

      return () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          checkServiceWorker
        );
      };
    }
  }, []);

  // Push subscription status monitoring
  useEffect(() => {
    const checkPushSubscription = async () => {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsPushSubscribed(!!subscription);
        } catch (error) {
          console.error("Error checking push subscription:", error);
        }
      }
    };

    checkPushSubscription();
  }, []);

  // PWA install prompt monitoring
  useEffect(() => {
    const checkInstallPrompt = () => {
      setCanInstall(isInstallPromptAvailable());
    };

    window.addEventListener("beforeinstallprompt", checkInstallPrompt);
    window.addEventListener("appinstalled", () => setCanInstall(false));

    return () => {
      window.removeEventListener("beforeinstallprompt", checkInstallPrompt);
      window.removeEventListener("appinstalled", () => setCanInstall(false));
    };
  }, []);

  // Cache status
  const refreshCacheStatus = useCallback(async () => {
    try {
      const status = await getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error("Error getting cache status:", error);
    }
  }, []);

  useEffect(() => {
    if (isServiceWorkerActive) {
      refreshCacheStatus();
    }
  }, [isServiceWorkerActive, refreshCacheStatus]);

  // Cache management
  const clearCache = useCallback(async () => {
    try {
      await clearWeatherCache();
      await refreshCacheStatus();
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }, [refreshCacheStatus]);

  // Background sync
  const requestSync = useCallback(async (tag = "weather-sync") => {
    try {
      await requestBackgroundSync(tag);
    } catch (error) {
      console.error("Error requesting background sync:", error);
    }
  }, []);

  // Push notifications
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    try {
      const subscription = await subscribeToPushNotifications();
      const success = !!subscription;
      setIsPushSubscribed(success);
      return success;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      return false;
    }
  }, []);

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    try {
      const success = await unsubscribeFromPushNotifications();
      setIsPushSubscribed(!success);
      return success;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      return false;
    }
  }, []);

  // PWA installation
  const promptInstall = useCallback(async (): Promise<boolean> => {
    try {
      const success = await showInstallPrompt();
      if (success) {
        setCanInstall(false);
      }
      return success;
    } catch (error) {
      console.error("Error showing install prompt:", error);
      return false;
    }
  }, []);

  // Utility functions
  const formatCacheSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  const formatLastUpdated = useCallback((timestamp: number): string => {
    if (!timestamp) return "Never";

    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);

  return {
    // Network status
    isOnline: isOnlineState,
    isOffline: !isOnlineState,

    // Cache management
    cacheStatus,
    clearCache,
    refreshCacheStatus,

    // Service worker status
    isServiceWorkerActive,
    requestSync,

    // Push notifications
    isPushSupported: "serviceWorker" in navigator && "PushManager" in window,
    isPushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,

    // PWA installation
    canInstall,
    promptInstall,

    // Utility functions
    formatCacheSize,
    formatLastUpdated,
  };
};
