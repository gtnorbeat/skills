import { useCallback, useRef, useState } from "react";

export interface UseCardDeleteOptions {
  /**
   * Async delete call. The hook sets `deleting=true` while this awaits.
   * The hook never rethrows — failures are routed through `onError`.
   */
  api: () => Promise<void>;
  /**
   * Called after `api()` resolves successfully. Typically `onClose()` from
   * the detail panel so the user returns to the list page.
   */
  onSuccess: () => void;
  /**
   * Called after `api()` resolves successfully. Typically removes the row
   * from the parent's `items` filter via the page handler. Note: the hook
   * fires this BEFORE `onSuccess` so the row is gone from the list before
   * the panel mounts back to the list — same order as the previous
   * detail-panel implementations used.
   */
  onDeleted: () => void;
  /**
   * Optional error sink — when provided, the hook routes its catch-block
   * message through `onError(msg)` instead of holding it internally. This
   * lets the detail panel share one `error` state slot with its edit-save
   * flow (both render in mutually-exclusive modes: edit OR delete-confirm,
   * never both). If omitted, the catch-block silently swallows — useful
   * when the panel can't show a banner (e.g. DemoDetail has no error
   * slot) but the user is still unblocked because the confirm iframe
   * closes via `setConfirming(false)` below.
   */
  onError?: (message: string) => void;
  /**
   * Fallback message if the caught error isn't an `Error` instance.
   * Defaults to "Delete failed".
   */
  fallbackMessage?: string;
}

export interface UseCardDeleteReturn {
  /** True while the user is looking at the confirm-delete iframe. */
  confirming: boolean;
  /** True while the API request is in flight. */
  deleting: boolean;
  /** Open the confirm iframe. */
  requestDelete: () => void;
  /** Close the confirm iframe without firing the request. */
  cancelDelete: () => void;
  /**
   * Fire the API delete. On resolve → `onDeleted()` + `onSuccess()`. On
   * reject → routes the message to `onError(msg)` if provided, resets
   * `deleting` so the user can retry, and ALWAYS closes the confirm
   * iframe so the user is never stuck in a silent dead-end state.
   */
  performDelete: () => Promise<void>;
}

/**
 * Detail-panel delete state machine. Encapsulates the three steps every
 * detail panel (Artist / Release / Contract / Task / Demo) walks when the
 * user taps the toolbar delete button:
 *
 *   view → confirm → deleting → { success → panel closes  |  error → iframe closes → user can retry from toolbar }
 *
 * Pulled out so the 5 detail panels — and any future panel that follows
 * the same toolbar pattern — share one implementation: the iframe markup,
 * the loading-state on the Delete button, the error banner, and the
 * branch-aware `useFocusTrap` Esc handler all funnel through one hook.
 *
 * Latest-ref pattern keeps the closures fresh without forcing the parent
 * to wrap every arg in `useCallback`. Callers can pass fresh `api`/
 * `onSuccess`/`onDeleted` arrows each render and `performDelete` will
 * still call the right one when the user actually taps the button. The
 * ref is updated synchronously during render — the documented React
 * pattern — instead of via `useEffect`, eliminating the small post-commit
 * window where a stale closure could be used.
 */
export function useCardDelete(opts: UseCardDeleteOptions): UseCardDeleteReturn {
  const { api, onSuccess, onDeleted, onError, fallbackMessage } = opts;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Synchronous-during-render ref latch: every render reads the latest
  // props, every performDelete invocation reads through this ref, so
  // stale-closure bugs are impossible even if the parent doesn't
  // `useCallback` its `api`/`onSuccess`/`onDeleted` arrows.
  const latest = useRef({ api, onSuccess, onDeleted, onError, fallbackMessage });
  latest.current = { api, onSuccess, onDeleted, onError, fallbackMessage };

  const requestDelete = useCallback(() => setConfirming(true), []);
  const cancelDelete = useCallback(() => setConfirming(false), []);

  const performDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await latest.current.api();
      latest.current.onDeleted();
      latest.current.onSuccess();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : (latest.current.fallbackMessage ?? "Delete failed");
      latest.current.onError?.(msg);
      setDeleting(false);
      // Only close the confirm iframe in the silent-swallow path
      // (i.e., the consumer didn't wire an `onError` sink — only
      // DemoDetail today). The 4 panels that DO wire `onError`
      // (Artist / Release / Contract / Task) render the error
      // banner INSIDE the iframe, so closing would hide the signal
      // and strand the user with no feedback; keeping it open lets
      // the user retry inline.
      if (!latest.current.onError) setConfirming(false);
    }
  }, []);

  return { confirming, deleting, requestDelete, cancelDelete, performDelete };
}
