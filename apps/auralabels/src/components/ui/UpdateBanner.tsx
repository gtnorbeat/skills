import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";

/**
 * Update-available banner. When the service worker has a new version
 * waiting to activate, this renders a thin cyan bar between the Header
 * and the main content area. The "Refresh now" button triggers
 * `applyUpdate()` which sends `SKIP_WAITING` to the waiting SW, and the
 * `controllerchange` listener in the hook reloads the page so the fresh
 * cached assets load immediately.
 *
 * Accessibility: `role="status"` (polite) so screen-readers announce
 * the update availability without interrupting the user's current
 * task. The banner auto-disappears after the reload (fresh page = no
 * waiting SW).
 *
 * MOBILE_FIRST Phase 8 — proactive update notification.
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 border-b border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-center backdrop-blur-sm"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
      <p className="text-xs font-medium text-cyan-700/90">
        A new version is available
      </p>
      <button
        type="button"
        onClick={applyUpdate}
        className="rounded-md bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/30 hover:text-cyan-800"
      >
        Refresh now
      </button>
    </div>
  );
}
