import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Wrap React.lazy for modules that export a single named component
 * (the codebase convention) instead of `export default`. Cuts ~3 lines
 * of `.then((m) => ({ default: m.X }))` boilerplate at every call site.
 *
 * Usage: `const ArtistPage = lazyNamed(() => import("./ArtistPage"), "ArtistPage");`
 */
// Infer the lazy component's props from the source module's named
// export. Without this, every call site would lose TypeScript prop
// checking (the result would fall back to ComponentType<{}>, so
// `<TaskDetail task={...} />` would not see the `task` prop). The
// generic inferring the M and K key keeps call sites idiomatic.
export function lazyNamed<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  M extends Record<string, ComponentType<any>>,
  K extends keyof M,
>(
  importer: () => Promise<M>,
  exportName: K,
): LazyExoticComponent<M[K]> {
  return lazy(() =>
    importer().then((m) => ({ default: m[exportName] } as { default: M[K] })),
  );
}
