import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * React error boundary that catches rendering errors thrown during
 * the render phase of its subtree and replaces the crashed tree with
 * a dark-themed fallback. Sync errors inside event handlers /
 * async callbacks / setTimeout are NOT caught by error boundaries
 * (that's by React design — see the docs on try/catch for those).
 *
 * The fallback shows the error message inline and provides a
 * "Try again" button that resets the boundary's error state,
 * forcing a clean re-render of the children. If the same error
 * recurs (e.g. a persistent data-shape mismatch), the fallback
 * re-appears after the next render crash.
 *
 * Usage: wrap any subtree that you want to isolate from taking
 * down the entire page (e.g. a single route, a sidebar panel,
 * the dashboard's widget tree). App.tsx wraps each route and
 * the rail mount individually so a crash in /artists never
 * breaks the surrounding chrome.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback — overrides the default dark-themed card. */
  fallback?: ReactNode;
  /** Called after the boundary catches an error (logging / analytics). */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to the console so devtools sessions catch the stack.
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Detects whether an error is a chunk-load failure (the dynamic
   * import for a lazy route couldn't fetch the JS bundle). This
   * happens when the user is offline and the chunk isn't cached, or
   * when a deploy invalidates a hash and the old chunk is gone.
   *
   * MOBILE_FIRST Phase 8 — distinguish connectivity-driven failures
   * from genuine render crashes so the fallback message is
   * actionable instead of misleading.
   */
  private isChunkLoadError(error: Error): boolean {
    const msg = error.message || error.name || "";
    return (
      msg.includes("Loading chunk") ||
      msg.includes("Loading CSS chunk") ||
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      error.name === "ChunkLoadError"
    );
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunk = this.state.error ? this.isChunkLoadError(this.state.error) : false;
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

      return (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-red-500/10 bg-red-500/5 px-6 py-10 text-center"
        >
          <span className="text-2xl text-red-500/70" aria-hidden="true">
            ⚠
          </span>
          <p className="text-sm font-semibold text-red-600">
            {isChunk ? "Couldn't load this page" : "Something went wrong"}
          </p>
          <p className="max-w-md text-xs text-zinc-500">
            {isChunk
              ? isOffline
                ? "You're offline and this page hasn't been cached yet. Reconnect and try again."
                : "This page couldn't be loaded — it may have been updated. Reload to get the latest version."
              : this.state.error?.message ??
                "An unexpected error occurred while rendering this section."}
          </p>
          {isChunk ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-600 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/20 hover:text-cyan-700"
            >
              Reload page
            </button>
          ) : (
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-1 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-700"
            >
              Try again
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
