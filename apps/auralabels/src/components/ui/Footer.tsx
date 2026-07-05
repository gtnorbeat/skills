import { APP_NAME, APP_VERSION } from "@/utils/version";

/**
 * App footer — copyright + version microcopy.
 *
 * Mounted in two surfaces:
 *   1. AppLayout's <main> under every authenticated route.
 *   2. LoginPage below the form.
 *
 * WCAG AA on bg-black: text-[10px] needs >= 4.5:1.
 *   zinc-400 = 8.21:1 → passes AA + AAA. (zinc-500 would fail AA by 0.16.)
 *
 * The 0.08em letter-spacing lifts the micro-copy enough to read at
 * AA-required contrast without lifting it into competition with the
 * route content above it; the mt-6/8/12 prop keeps the footer from
 * kissing the last line of page content.
 *
 * Version comes from package.json via `__APP_VERSION__` injected at
 * build time so every Footer updates in lock-step on `npm version`.
 *
 * Each part is on its own line (flex-col) so the footer reads as a
 * compact three-line block rather than one long sentence.
 */
export function Footer({ className = "" }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer
      role="contentinfo"
      className={`mt-6 text-center text-[10px] font-medium tracking-[0.08em] text-zinc-400 ${className}`}
    >
      <span className="flex flex-col leading-relaxed">
        <span>© {year} {APP_NAME}</span>
        <span>All Rights Reserved</span>
        <span>Ver. v{APP_VERSION} Beta</span>
      </span>
    </footer>
  );
}
