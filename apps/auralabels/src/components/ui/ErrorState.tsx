/**
 * Standardized error-state display. Replaces the per-page ad-hoc
 * `{error && <p className="text-xs text-red-400">{error}</p>}`
 * pattern with a consistent dark-themed card that includes a
 * prominent Retry button when the caller provides `onRetry`.
 *
 * Semantic notes:
 *   - `role="alert"` so screen-readers announce the error on mount.
 *   - The Retry button carries the global 44×44 px touch-target via
 *     the existing index.css rule (no extra classes needed).
 *   - `message` is the only required prop — the icon and layout
 *     are always present so the card never reads as orphaned text.
 */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-red-500/10 bg-red-500/5 px-6 py-8 text-center"
    >
      <span className="text-2xl text-red-500/70" aria-hidden="true">
        ⚠
      </span>
      <p className="max-w-md text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}
