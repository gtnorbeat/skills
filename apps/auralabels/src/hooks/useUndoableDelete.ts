import { useToast } from "@/components/ui/Toast";

/**
 * Generic hook for the "delete with undo snackbar" flow. Wraps the
 * four-step pattern that every list page (ArtistPage / ReleasePage /
 * ...) is migrating to:
 *
 *   1. Optimistically filter the row out of the local list so the user
 *      sees instant feedback.
 *   2. Fire the API DELETE in the background; on error, re-insert the
 *      snapshot at its original index and surface a toast.error so the
 *      user isn't left wondering why the row came back.
 *   3. On success, push a confirmation toast with an in-line Undo
 *      button + a thin cyan countdown bar at the bottom (driven by
 *      `duration` in the toast). The bar drains in lockstep with the
 *      toast's auto-dismiss timer; the user has `duration` ms to act.
 *   4. If Undo is clicked, POST `{id}` + the snapshot back to the
 *      server's restore endpoint and re-insert the row at the same
 *      index it had before delete. After the undo, an info toast
 *      confirms the row is back.
 *
 * Pages call this hook once with their `setItems` and a label
 * formatter and then pass `hook.delete(item)` to every card's
 * `onDelete` handler. The hook owns the snapshot, the optimism, the
 * toast, and the rollback — pages only own routing (e.g. closing
 * an open detail panel after successful delete).
 *
 * Snapshot: `JSON.parse(JSON.stringify(item))` is the cheapest correct
 * option for these flat-list types — they all serialise to JSON
 * without cycles or Date objects that would survive the trip back to
 * the server. If we ever introduce entities with `Date` columns in
 * the snapshot, swap this for a structuredClone with revival.
 */
export interface UndoableDeleteOptions<T> {
  /** API call that performs the actual deletion. */
  apiDelete: (id: string) => Promise<void>;
  /** API call that reinserts a row by id from a client snapshot. */
  apiRestore: (id: string, snapshot: T) => Promise<T>;
  /** Current value of the list — needed to capture the original position
   *  of the row so undo can re-insert at the same index. */
  items: T[];
  /** React setState dispatch for the list. */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  /**
   * Builds the toast copy. "Artist 'Beatsmith' deleted" reads better
   * than "Artist {object} deleted", and the function form lets callers
   * vary the noun per entity (Task, Demo, Campaign, ...) without
   * inheritance gymnastics.
   */
  labelFn: (item: T) => string;
  /**
   * Called after a successful restore. Pages usually don't need this —
   * the list is already updated — but it's exposed so callers can
   * (e.g.) re-attach an open detail panel to the freshly-restored row
   * if they want the detail-view route to stay in sync.
   */
  onRestored?: (item: T) => void;
  /**
   * Optional override for the toast countdown window. Defaults to
   * 5500ms — slightly longer than the regular toast so the user has
   * a beat to spot the Undo button. Bump if you're showing long copy.
   */
  undoDurationMs?: number;
}

// Generic-typed API surface. The `T` here is independent of (and
// inferred from) the generic on `useUndoableDelete<T>` — declaring
// it on the interface keeps the call shape stable so callers can
// destructure `{ delete }` and pass the resulting function around
// without losing the item type.
export interface UndoableDeleteApi<T> {
  /**
   * Trigger an undoable delete of the given item. Optimistically
   * removes the row, fires the API, and surfaces a toast. Resolves
   * after the dismiss-or-restore branch completes — callers can
   * `await` to do post-delete routing (close an open detail panel,
   * update breadcrumbs, etc).
   */
  delete: (item: T) => Promise<void>;
}

export function useUndoableDelete<T extends { id: string }>(
  opts: UndoableDeleteOptions<T>
): UndoableDeleteApi<T> {
  const { toast } = useToast();

  async function deleteItem(item: T): Promise<void> {
    // Deep clone so the optimistic-removed snapshot is not aliased to
    // any live state if a parent then runs a `setState` that re-touches
    // the row object before the API returns.
    const snapshot = JSON.parse(JSON.stringify(item)) as T;
    // Capture the row's position before filtering so undo can put it
    // back where the user expects — the rest of the list below it
    // shifts up by one slot while the row is gone, and the eye-tracked
    // "scroll-to" position becomes unpredictable for very long lists.
    const originalIndex = opts.items.findIndex((x) => x.id === item.id);
    // Hoist the label string once so the toast call sites below don't
    // re-invoke labelFn (a closure over per-page state) for every
    // toast.update. lslabel is small, but keeping a single source of
    // truth here also means the "deleted" and "restored" copy stays
    // in lockstep if labelFn ever grows into something more complex.
    const label = opts.labelFn(snapshot);

    // Optimistic remove — the row disappears immediately so feedback
    // is synchronous, matching native delete semantics. Failure case
    // below reverses this on error.
    opts.setItems((prev) => prev.filter((x) => x.id !== item.id));

    try {
      await opts.apiDelete(item.id);
    } catch (err) {
      // Rollback. We re-insert the original snapshot at originalIndex
      // so the user sees the row bounce back exactly where it was,
      // not appended to the bottom of the list (which would be
      // visually confusing for cards in the middle of a long grid).
      opts.setItems((prev) => {
        if (prev.some((x) => x.id === snapshot.id)) return prev;
        const insertAt =
          originalIndex < 0 || originalIndex > prev.length
            ? prev.length
            : originalIndex;
        return [...prev.slice(0, insertAt), snapshot, ...prev.slice(insertAt)];
      });
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return;
    }

    // Confirmation toast with in-line Undo action. The toast stays in
    // place long enough for a multi-second restore round-trip — see
    // ToastItem's `pending` handling: while onClick is in flight, the
    // auto-dismiss timer freezes and the button enters a disabled
    // "..." state so the user never loses the affordance mid-restore.
    toast.action(
      `${label} deleted`,
      {
        label: "Undo",
        onClick: async () => {
          try {
            // Hard 8 s ceiling on the restore round-trip. Without it,
            // a hung network request keeps `pending=true` on the toast
            // forever (the toast's auto-dismiss effect early-returns
            // while pending), which strands the user on a toast they
            // can't act on. 8 s is twice the toast's display budget
            // (5500 ms) so a healthy network finishes well inside the
            // window; the cap only triggers on genuine hang / server
            // crash mid-INSERT — both of which degrade to a toast.error
            // via the outer catch.
            const RESTORE_TIMEOUT_MS = 8000;
            const restored = await Promise.race([
              opts.apiRestore(snapshot.id, snapshot),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Restore timed out — please retry")),
                  RESTORE_TIMEOUT_MS,
                ),
              ),
            ]);
            opts.setItems((prev) => {
              if (prev.some((x) => x.id === restored.id)) return prev;
              const insertAt =
                originalIndex < 0 || originalIndex > prev.length
                  ? prev.length
                  : originalIndex;
              return [...prev.slice(0, insertAt), restored, ...prev.slice(insertAt)];
            });
            opts.onRestored?.(restored);
            toast.success(`${label} restored`);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Failed to restore"
            );
          }
        },
      }
    );
  }

  return { delete: deleteItem };
}
