import { useState, useEffect } from "react";

/**
 * Tracks the browser's online/offline status via `navigator.onLine`
 * and the `online` / `offline` window events. Returns the current
 * status as a boolean so any component can gate its network-dependent
 * UI (offline banner, retry affordances, disabled submit buttons)
 * without re-wiring the event listeners manually.
 *
 * Initialises from `navigator.onLine` at mount time — no flash of the
 * wrong state on first paint — and re-renders on every
 * `online`/`offline` transition for the component's lifetime.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true; // SSR safety
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}
