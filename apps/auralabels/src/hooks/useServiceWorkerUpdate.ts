import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Tracks the service worker lifecycle and detects when a new version
 * is installed but waiting to activate (the user would need to close
 * all tabs to get it otherwise).
 *
 * Returns:
 *   - `updateAvailable`: true when a waiting SW is detected
 *   - `applyUpdate`: sends SKIP_WAITING to the waiting SW, which
 *     triggers `controllerchange` — the page reloads on that event
 *     to load the fresh assets
 *
 * MOBILE_FIRST Phase 8 — proactive update notification so users
 * always know when a new deploy is ready without needing to close
 * and reopen all tabs.
 *
 * Implementation notes:
 *   - `updatefound` is a ServiceWorkerRegistration event, NOT a
 *     ServiceWorkerContainer event. We must get the registration
 *     first and attach the listener there.
 *   - `controllerchange` fires on both first install and subsequent
 *     updates. We track an `applyUpdateRequested` ref so we only
 *     reload when the user explicitly accepted the update — a first
 *     install's controllerchange is a no-op.
 */
export function useServiceWorkerUpdate(): {
  updateAvailable: boolean;
  applyUpdate: () => void;
} {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const applyUpdateRequested = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const container = navigator.serviceWorker;
    let activeRegistration: ServiceWorkerRegistration | undefined;

    function checkWaiting(reg: ServiceWorkerRegistration | undefined) {
      if (reg?.waiting) {
        setUpdateAvailable(true);
      }
    }

    // Get the registration and attach updatefound to IT (not the container).
    container.getRegistration().then((reg) => {
      activeRegistration = reg;
      checkWaiting(reg);
      reg?.addEventListener("updatefound", onUpdateFound);
    }).catch(() => {});

    // updatefound fires on the ServiceWorkerRegistration, not the container.
    function onUpdateFound(event: Event) {
      const reg = event.target as ServiceWorkerRegistration;
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // Only signal an update if there's an existing controller —
        // a first install has no prior controller so this is not an update.
        if (installing.state === "installed" && container.controller) {
          setUpdateAvailable(true);
        }
      });
    }

    // controllerchange fires on both first install and updates. Only
    // reload when the user explicitly requested the update via applyUpdate.
    function onControllerChange() {
      if (applyUpdateRequested.current) {
        window.location.reload();
      }
    }
    container.addEventListener("controllerchange", onControllerChange);

    return () => {
      activeRegistration?.removeEventListener("updatefound", onUpdateFound);
      container.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    applyUpdateRequested.current = true;
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    }).catch(() => {});
  }, []);

  return { updateAvailable, applyUpdate };
}
