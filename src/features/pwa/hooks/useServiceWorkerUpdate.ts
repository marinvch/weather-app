import { useCallback, useEffect, useState } from "react";
import {
  applyServiceWorkerUpdate,
  isUpdateAvailable,
  onServiceWorkerUpdate,
} from "@/features/pwa/lib/serviceWorker";

export interface ServiceWorkerUpdateState {
  /** A new service worker has installed and is waiting to take over. */
  updateAvailable: boolean;
  /** Activate the waiting worker and reload once it controls the page. */
  applyUpdate: () => void;
}

/**
 * Drives the "a new version is available" prompt. The worker installs in the
 * background and then waits: nothing swaps under a running page until this
 * hook's `applyUpdate` is called.
 */
export const useServiceWorkerUpdate = (): ServiceWorkerUpdateState => {
  const [updateAvailable, setUpdateAvailable] = useState(isUpdateAvailable);

  useEffect(() => onServiceWorkerUpdate(setUpdateAvailable), []);

  const applyUpdate = useCallback(() => {
    applyServiceWorkerUpdate();
  }, []);

  return { updateAvailable, applyUpdate };
};
