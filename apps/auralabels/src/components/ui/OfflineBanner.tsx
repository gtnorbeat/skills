import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * Persistent offline banner. When the browser reports `navigator.onLine
 * === false`, this renders a thin amber bar between the Header and the
 * main content area. Automatically disappears when connectivity returns.
 *
 * Accessibility: `role="alert"` ensures screen-readers announce the
 * banner when it first appears. The label text is short and
 * action-oriented — the SW already caches the app shell so the user
 * can still navigate, but data-bound pages will show stale/empty
 * content until connectivity returns.
 *
 * Mounted inside AppLayout so it's always present in the DOM tree
 * regardless of which route is active.
 */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center backdrop-blur-sm"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
      <p className="text-xs font-medium text-amber-700">
        You&apos;re offline — some features may be unavailable
      </p>
    </div>
  );
}
