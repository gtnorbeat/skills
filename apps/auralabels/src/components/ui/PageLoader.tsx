/**
 * Reusable Suspense fallback. Renders the brand-aligned spinner pattern
 * used elsewhere (cyan border, dark backdrop) but bounded to its parent's
 * content area so it slots inside <Suspense> boundaries without taking
 * the full viewport. When `message` is an explicit empty string
 * (`""`), the `<p>` below the spinner is skipped entirely so the
 * wrapper's `gap-3` doesn't leave a visible vertical void.
 * Callers that own the accessible name via an outer `aria-label`
 * can pass `message=""` to silence the inner announcement without
 * paying a layout penalty — omitting the prop keeps the default
 * "Loading…" instead.
 */
export function PageLoader({ message = "Loading\u2026" }: { message?: string } = {}) {
  return (
    <div className="flex h-full w-full items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        {message ? <p className="text-xs text-zinc-500">{message}</p> : null}
      </div>
    </div>
  );
}
