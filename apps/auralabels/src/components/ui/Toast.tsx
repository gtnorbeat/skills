import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";

type ToastType = "success" | "error" | "info";

/**
 * Optional CTA that the user can fire from inside a toast before it
 * dismisses itself. Currently used for "Undo" on a delete action, but
 * the surface is general — anything time-boxed where the user has a
 * beat to opt into a different action.
 *
 * If `onClick` returns a Promise, the toast freezes its countdown
 * until the promise settles (see ToastItem: freezes `duration` timer
 * and the action button enters a pending state) so a multi-second
 * API round-trip never costs the user the affordance.
 */
export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Optional in-toast CTA. */
  action?: ToastAction;
  /**
   * Per-toast override for the auto-dismiss delay (ms). Defaults are
   * applied by ToastProvider based on whether `action` is set: an
   * undo-style toast gets a longer beat (5500ms) so the user has time
   * to spot and click; a plain confirmation reuses the existing
   * 4000ms chime. Override only when copy length requires more time
   * (e.g. multi-clause messages).
   */
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    /**
     * Confirmation-style toast with an in-line action button. Used by
     * the undoable-delete flow on every list card. The action's
     * click handler is async-aware: if it returns a Promise, the
     * toast freezes (the countdown bar stops, the action button
     * enters a pending state) until the promise settles, so the user
     * doesn't lose the affordance during an API round-trip.
     */
    action: (message: string, action: ToastAction) => void;
  };
  /**
   * Stable-by-id dismiss API. Exposed so consumers (and ToastItem
   * itself) can settle the auto-dismiss timer without re-creating
   * the timer on every Provider render — the previous `onDone`
   * inline arrow caused every other live toast's countdown to
   * reset whenever any new toast was added.
   *
   * Most app code never needs this directly; it's wired into
   * ToastItem via prop for the lifecycle fix.
   */
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

// ── Toast icons ──

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case "error":
      return (
        <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case "info":
      return (
        <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

// ── Color classes per type ──

function toastBorder(type: ToastType): string {
  switch (type) {
    case "success": return "border-emerald-500/20";
    case "error": return "border-red-500/20";
    case "info": return "border-cyan-500/20";
  }
}

function toastBg(type: ToastType): string {
  switch (type) {
    case "success": return "bg-emerald-500/5";
    case "error": return "bg-red-500/5";
    case "info": return "bg-cyan-500/5";
  }
}

// ── Single toast item ──

/**
 * Renders one toast. Receives the provider's stable `dismiss` (a
 * `useCallback([])` wrapper around the setToasts removal) instead of
 * an inline `onDone` arrow so the effect deps `[duration, pending,
 * toastId, dismiss]` are stable for the toast's lifetime. Stable
 * deps are critical: with an unstable `onDone` prop the effect's
 * cleanup (`clearTimeout`) ran on EVERY parent re-render, which
 * meant adding or removing any toast reset every other live toast's
 * auto-dismiss countdown. That bug surfaced in QA as "the toast
 * stays way longer than its visual bar implies"; this is the fix.
 */
function ToastItem({
  t,
  dismiss,
}: {
  t: Toast;
  dismiss: (id: string) => void;
}) {
  // role + aria-live split: errors escalate to assertive so screen-reader
  // users hear them on the spot, success/info slide in politely so they
  // don't interrupt whatever the user is reading. The dismiss <button>
  // is bumped to a 44 px touch target so phones can clear a toast without
  // mis-tap.
  const role = t.type === "error" ? "alert" : "status";
  const ariaLive = t.type === "error" ? "assertive" : "polite";

  // Default beat. Toasts that carry an `action` get a slightly longer
  // window (5500ms) so the user has time to spot and click the CTA; a
  // plain confirmation reuses the existing 4000ms chime. Per-toast
  // override via `duration` is honoured on top.
  const duration = t.duration ?? (t.action ? 5500 : 4000);

  // Action-pending state — locks the dismissal timer and visually
  // disables the action button while an async onClick is in flight.
  // Without it the toast would auto-dismiss mid-restore and the user
  // would still get the result via setItems + a follow-up toast, but
  // the affordance ("Undo") would already be gone.
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (pending) return;
    const id = setTimeout(() => dismiss(t.id), duration);
    return () => clearTimeout(id);
  }, [duration, pending, t.id, dismiss]);

  async function handleAction() {
    if (!t.action || pending) return;
    setPending(true);
    try {
      await t.action.onClick();
    } catch {
      // Caller is responsible for surfacing errors via toast.error();
      // we still dismiss in finally so the toast stack stays clean.
    } finally {
      dismiss(t.id);
    }
  }

  return (
    <div
      className={`relative overflow-hidden flex items-center gap-2.5 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-in-slide ${toastBorder(t.type)} ${toastBg(t.type)}`}
      role={role}
      aria-live={ariaLive}
    >
      <ToastIcon type={t.type} />
      <p className="text-xs font-medium text-zinc-300">{t.message}</p>
      {t.action && (
        <button
          type="button"
          onClick={handleAction}
          disabled={pending}
          aria-label={t.action.label}
          className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {pending ? "..." : t.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss notification"
        className="ml-1 flex h-11 w-11 items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 active:text-zinc-200 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* Countdown bar — only on toasts that carry an action, since the
          bar represents the "undo window" specifically (regular info /
          success toasts just time out without a visual cue). Anchored
          along the bottom edge so it doesn't fight the icon / button
          row for vertical space. `pointer-events: none` keeps the bar
          from intercepting clicks over the toast body. */}
      {t.action && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400/60"
          style={{
            transformOrigin: "left center",
            transform: "scaleX(0)",
            animation: `aura-toast-shrink ${duration}ms linear forwards`,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// ── Provider ──

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((type: ToastType, message: string, opts?: { action?: ToastAction; duration?: number }) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, type, message, action: opts?.action, duration: opts?.duration }]);
  }, []);

  // Stable across the Provider's lifetime so consumers (ToastItem +
  // any future external consumer) referencing it in effect deps don't
  // get reset on every render. This is the keystone of the timer-reset
  // fix above — should never switch to an inline arrow without first
  // auditing every useEffect that depends on it.
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    toast: {
      success: (msg: string) => addToast("success", msg),
      error: (msg: string) => addToast("error", msg),
      info: (msg: string) => addToast("info", msg),
      action: (msg: string, action: ToastAction) => addToast("info", msg, { action }),
    },
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container — bottom-anchored on mobile (better thumb reach,
         doesn't fight the top status chip / page chrome), top-anchored on
         desktop (matches the historical pattern). Full-width on phones so
         dismiss + copy don't crush against the edge; capped at max-w-sm
         on sm+ so longer reads stay comfortable. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[9999] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:max-w-sm sm:items-end">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} dismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
