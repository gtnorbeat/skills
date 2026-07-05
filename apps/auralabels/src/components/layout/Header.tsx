import { Link, useLocation } from "react-router-dom";
import { NotificationCenter } from "./NotificationCenter";
import { UserMenu } from "./UserMenu";
import { AuraAMark } from "@/components/ui/AuraAMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { AuraVariant } from "@/components/ui/AuraAMark";

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Logged-in display name; when present, the account chip is rendered. */
  username?: string | null;
  /** Sign-out callback forwarded to the user menu. */
  onSignOut?: () => void;
  onMenuClick?: () => void;
  menuOpen?: boolean;
  onMenuButtonRef?: (el: HTMLButtonElement | null) => void;
  /**
   * Mobile affordance for the global chrome swap (Sidebar ↔ AI rail
   * sides). On xl+ viewports the desktop Sidebar footer owns this so
   * this prop drives the smaller ⇄ icon next to the hamburger menu.
   * Forwarded from AppLayout's `handleSwap` so both surfaces toggle the
   * same `isSwapped` state.
   */
  onSwap?: () => void;
  /** Reflects the persistent AI Assistant rail toggle (parent-owned). */
  aiRailOpen?: boolean;
  /**
   * Live AI activity tint that the AuraAMark inside the rail toggle
   * inherits via currentColor, and which the toggle button's bg/border
   * also picks up so the active state stays colour-consistent with the
   * mark. Falls back to "brand" (cyan) when not wired, preserving the
   * pre-state-wiring look.
   */
  aiStatus?: Exclude<AuraVariant, "brand">;
  /** Toggles the persistent AI Assistant rail owned by AppLayout. */
  onToggleAiRail?: () => void;
  /**
   * Optional CSS className escape hatch forwarded onto the title <h1>.
   * AppLayout passes "font-display uppercase" on the Dashboard,
   * Artists, Releases, and AI Assistant routes to render the title in
   * Ethnocentric Light with the brand-class upright case treatment;
   * other routes leave this undefined so the default `font-heading`
   * (ui-sans-serif weight 600) applies unchanged. Keeps chrome
   * typography per-route rather than a global redesign.
   */
  titleClassName?: string;
}

export function Header({
  title,
  subtitle,
  username,
  onSignOut,
  onMenuClick,
  menuOpen,
  onMenuButtonRef,
  onSwap,
  aiRailOpen,
  aiStatus,
  onToggleAiRail,
  titleClassName,
}: HeaderProps) {
  // Header ⇄ at sm-md (640-1023) and ✦ Link-to-/ai on <sm — both require
  // knowing which viewport we're wired for. useLocation gives us the
  // current pathname so the Link can advertise `aria-current="page"` when
  // the user is already on /ai (so the SR announcement matches what's
  // already showing). Cheap: react-router-dom's useLocation is a single
  // matchPath call — no subscription / re-render cost beyond a route
  // change, which the Header already rerenders on via the parent
  // AppLayout's location-driven chrome pass.
  const location = useLocation();
  const isAiPage = location.pathname.startsWith("/ai");
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-black/20 bg-[#e4dfd8] px-3 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuClick && (
          <button
            ref={onMenuButtonRef}
            onClick={onMenuClick}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen ?? false}
            aria-controls="app-sidebar"
          className="hidden sm:flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors xl:hidden"
        >
          <span className="text-base" aria-hidden="true">☰</span>
        </button>
        )}
        {/* Mobile swap ⇄ button (MOBILE_FIRST Phase 4) — hidden at <sm
            where no Sidebar/AI-rail geometry exists to swap between.
            Hidden at sm-lg (640-1023) because only the mobile drawer
            mounts at that range — toggling swap flips drawer side but
            the user can't see any other chrome change, which reads as
            a confusing near-no-op. Visible at lg-xl (1024-1279) where
            the AI rail IS mounted (lg:flex) but the desktop Sidebar
            isn't yet (xl:flex) — swapping here moves the AI rail
            between left and right, which IS a visible, meaningful
            change. Desktop Sidebar footer swap takes over at xl+.
            CSS-only flip of `flex` to `hidden lg:flex` keeps the
            touch-target rule (44×44) and the existing xl:hidden
            override intact. */}
        {onSwap && (
          <button
            onClick={onSwap}
            aria-label="Swap sidebar side"
            title="Swap which side the Sidebar opens from"
            /* Mobile swap ⇄ button (MOBILE_FIRST Phase 4) — hidden at <sm
               where no Sidebar/AI-rail geometry exists to swap between;
               hidden at sm-lg (640-1023) because without the AI rail
               mounted, toggling swap is a confusing near-no-op (only
               the mobile drawer side flips). Visible at lg-xl
               (1024-1279) as the only swap surface where the AI rail
               IS mounted but the desktop Sidebar isn't yet
               (desktop Sidebar footer swap takes over at xl+).
               CSS-only flip of `flex` to `hidden lg:flex` keeps the
               touch-target rule (44×44) and the existing xl:hidden
               override intact. */
            className="hidden lg:flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 transition-colors hover:bg-cyan-500/20 hover:text-cyan-200 xl:hidden"
          >
            <span aria-hidden="true">⇄</span>
          </button>
        )}
        <div className="min-w-0">
          <h1 className={`text-sm text-zinc-900 truncate ${titleClassName ?? "font-heading"}`}>{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-zinc-400 truncate hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 sm:gap-2">
        <ThemeToggle />
        <NotificationCenter />
        {/* AI Assistant link (MOBILE_FIRST Phase 1) — on <sm the AI rail
            is unconditionally hidden (the rail mounts via
            `hidden lg:block lg:w-64`), so toggling ✦ on a phone only
            re-writes localStorage while the user sees no chrome change.
            Route to the standalone `/ai` page instead so the affordance
            has a visible effect. At sm+ the toggle button below takes
            over (CSS-hidden via `hidden sm:flex`) — both surfaces link
            to /ai when on the route, so the SR's aria-current is in
            sync with what's actually rendered. icon variant tracks the
            live AI activity tint via the parent-forwarded aiStatus prop
            so the link chrome reads as consistent with the toggle. */}
        <Link
          to="/ai"
          /* Route-state-aware aria-label (code-review nit): the static
             "Open AI Assistant" reads misleadingly when the user is
             already on /ai (the /ai page IS open). Conditionalise on
             isAiPage so SR announces the actual visual state, in
             sync with aria-current="page" which already conveys the
             route semantics for AT that follows ARIA-built-in
             conventions. */
          aria-label={isAiPage ? "AI Assistant (currently open)" : "Open AI Assistant"}
          aria-current={isAiPage ? "page" : undefined}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors sm:hidden"
        >
          <span aria-hidden="true">
            <AuraAMark size={14} className="shrink-0" variant={aiStatus ?? "brand"} />
          </span>
        </Link>
        {onToggleAiRail && (
          <button
            onClick={onToggleAiRail}
            aria-label={aiRailOpen ? "Close AI Assistant" : "Open AI Assistant"}
            aria-pressed={aiRailOpen ?? false}
            aria-controls="ai-rail"
            title={aiRailOpen ? "Hide AI Assistant" : "Show AI Assistant"}
            /* 4-way static-string ternary so Tailwind v4 picks up every
               class branch at compile time (no dynamic concatenation).
               Active rail state follows the AI activity tint instead
               of staying cyan — keeps the button background consistent
               with the AuraAMark color when the icon is amber/fuchsia/
               emerald. Closed-fallback stays cyan on any un-wired
               variant. */
            /* AI rail toggle (MOBILE_FIRST Phase 1) — on ≥sm, the AI rail
               is the dest this button surfaces (via the AppLayout-owned
               render slot). On <sm the rail is unconditionally hidden
               so the corresponding affordance is the route navigator
               above; CSS swaps `flex` to `hidden sm:flex` to keep them
               from rendering twice at the same viewport. The
               internal ternary still picks bg/border for the 4-way tint
               grid untouched. */
            className={`hidden sm:flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              aiRailOpen && aiStatus === "thinking"
                ? "bg-amber-500/15 text-amber-400 aura-border-amber"
                : aiRailOpen && aiStatus === "result"
                  ? "bg-fuchsia-500/15 text-fuchsia-400 aura-border-fuchsia"
                  : aiRailOpen && aiStatus === "idle"
                    ? "bg-emerald-500/15 text-emerald-400 aura-border-emerald"
                    : aiRailOpen
                      ? "bg-cyan-500/15 text-cyan-400 aura-border-cyan"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            }`}
          >
            <span aria-hidden="true">
              <AuraAMark size={14} className="shrink-0" variant={aiStatus ?? "brand"} />
            </span>
          </button>
        )}
        {username && onSignOut && (
          <UserMenu username={username} onSignOut={onSignOut} />
        )}
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 sm:px-3">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-medium text-zinc-600 hidden sm:inline">Online</span>
        </div>
      </div>
    </header>
  );
}
