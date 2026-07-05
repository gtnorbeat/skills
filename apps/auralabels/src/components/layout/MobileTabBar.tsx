import { NavLink } from "react-router-dom";
import {
  DashboardIcon,
  ArtistsIcon,
  ReleasesIcon,
} from "@/components/ui/SidebarIcons";
import { AuraAMark } from "@/components/ui/AuraAMark";
import type { AuraVariant } from "@/components/ui/AuraAMark";
import { MoreIcon } from "@/components/ui/MobileTabIcons";

interface MobileTabBarProps {
  /** Live AI activity tint — drives the AI tab's AuraAMark colour so
   *  it stays synced with the Header rail toggle and the Sidebar's
   *  AI Assistant nav item (cyan idle-emerald / amber thinking /
   *  fuchsia result). Falls back to "brand" cyan when undefined. */
  aiStatus?: Exclude<AuraVariant, "brand">;
  /** Parent-owned drawer-open state. Drives the More tab's
   *  aria-expanded + visual `isActive` highlight so the user gets the
   *  same cyan recipe as a NavLink-on-active-route. */
  moreOpen?: boolean;
  /** Wired to AppLayout's setSidebarOpen(true) — opens the existing
   *  Sidebar drawer (which carries the long-tail destinations plus
   *  the Swap Layout button + Sign-out footer). */
  onMoreClick: () => void;
  /** Callback-ref pattern so AppLayout can wire the More button into
   *  its MobileDrawer focus-restore logic. The drawer catches Escape
   *  / backdrop clicks; restoring focus to whichever trigger opened
   *  the drawer last is the keyboard/SR muscle memory contract the
   *  Header ☰ already established. AppLayout stores two refs
   *  (menuButtonRef for sm-md Header ☰ + moreButtonRef for <sm
   *  bottom-tab More) and lastTrigger state decides which one is
   *  handed to MobileDrawer's `returnFocusRef` prop.
   *  Optional so isolated test mounts can omit it. */
  onMoreButtonRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * MOBILE_FIRST Phase 2 — the bottom-anchored navigation strip
 * visible only at `<sm`.
 *
 * Replaces the ☰ Header hamburger so the four primary destinations
 * (Dashboard / Artists / Releases / AI) sit within thumb-reach on phones,
 * with a fifth More tab that opens the existing `<MobileDrawer>`
 * (which contains both Sidebar nav covering the long-tail
 * destinations + the Swap Layout button + the Sign-out footer).
 *
 * Sticky bottom with
 * `padding-bottom: env(safe-area-inset-bottom)` so the home-indicator
 * on notched phones doesn't overlap the touch targets. z-40 sits
 * above main content (no z-index = 0 in the parent flex column),
 * below all detail-panel modals and Sidebar popovers (z-50+) and
 * below the imperative Toast (z-9999). Toasts floating above the bar
 * during their 5.5 s slide lifetime is the expected ordering — the
 * bar is a constant surface, toasts are ephemeral notifications.
 *
 * Active tab highlights use the same
 * `bg-cyan-500/10 text-cyan-400 aura-border-cyan` recipe as the
 * desktop Sidebar's active item so the 4 ↔ Sidebar nav reads as
 * visually rhymed across both surfaces. The AuraAMark icon size is
 * 20 (vs. Header's 14 / Sidebar's 16): the bottom-tab's viewport
 * is the largest of the three so the icon's live activity tint
 * reads at full saturation.
 *
 * The AI tab routes to `/ai` (no rail at <sm — the rail is
 * unconditionally `hidden lg:block`). The `aiStatus` prop is the
 * same parent-owned state Header + Sidebar consume so all three
 * surfaces tint in sync. On `/ai` the tab is highlighted via
 * react-router-dom's automatic `aria-current="page"`.
 *
 * Spec table (MOBILE_FIRST.md §4) confirms the 5-tab layout is
 * the canonical pattern for `<sm` — replaces the ☰ Hamburger and
 * becomes the primary nav surface below 640 px wide.
 *
 * aria-controls is only set when the controlled drawer is in the
 * DOM (sidebarOpen=true). When the drawer is closed the Sidebar's
 * `<aside id="app-sidebar">` is unmounted via MobileDrawer's
 * `if (!open) return null` early-return, so referencing a phantom
 * element via aria-controls would trip SR users; pass `undefined`
 * instead so the attribute is omitted on a closed-drawer state.
 */
export function MobileTabBar({
  aiStatus,
  moreOpen,
  onMoreClick,
  onMoreButtonRef,
}: MobileTabBarProps) {
  return (
    <nav
      aria-label="Primary navigation"
      /* Code-review fix — pinned to `sm:hidden` (not `md:hidden`) so
         the bottom-tab disappears at ≥640 px width, matching the
         MOBILE_FIRST.md §4 spec table (bottom-tab is `<sm` only —
         the `sm` column is intentionally `—`). The slide-out-tier
         navigator between 640-1023 px uses the Header ☰ as the
         canonical control — Mounting the bar at ≥640 ms alongside
         the Header ☰ would double-mount the same drawer-opener
         affordance in tablet portrait. */
      className="fixed inset-x-0 bottom-0 z-40 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-stretch border-t border-zinc-200 bg-white/85 backdrop-blur-md">
        <NavLink
          to="/"
          end
          aria-label="Dashboard"
          className={({ isActive }) => tabClass(isActive)}
        >
          <DashboardIcon size={20} className="shrink-0" />
          <span className={tabLabelClass}>Dashboard</span>
        </NavLink>

        <NavLink
          to="/artists"
          aria-label="Artists"
          className={({ isActive }) => tabClass(isActive)}
        >
          <ArtistsIcon size={20} className="shrink-0" />
          <span className={tabLabelClass}>Artists</span>
        </NavLink>

        <NavLink
          to="/releases"
          aria-label="Releases"
          className={({ isActive }) => tabClass(isActive)}
        >
          <ReleasesIcon size={20} className="shrink-0" />
          <span className={tabLabelClass}>Releases</span>
        </NavLink>

        <NavLink
          to="/ai"
          aria-label="AI Assistant"
          className={({ isActive }) => tabClass(isActive)}
        >
          <AuraAMark size={20} className="shrink-0" variant={aiStatus ?? "brand"} />
          <span className={tabLabelClass}>AI</span>
        </NavLink>

        <button
          ref={onMoreButtonRef}
          type="button"
          onClick={onMoreClick}
          aria-haspopup="dialog"
          aria-expanded={moreOpen ?? false}
          aria-controls={moreOpen ? "app-sidebar" : undefined}
          aria-label={moreOpen ? "Close more destinations" : "Open more destinations"}
          className={tabClass(moreOpen ?? false)}
        >
          <MoreIcon size={20} className="shrink-0" />
          <span className={tabLabelClass}>More</span>
        </button>
      </div>
    </nav>
  );
}

/**
 * Tab-pill className factory. Used by both NavLinks (driven by
 * `isActive` from react-router-dom) and the More button
 * (`moreOpen ? true : false`) so navigating to /promo via the More
 * drawer leaves the More tab highlighted while the user is in the
 * drawer. Returns the active recipe when truthy, neutral when false.
 */
function tabClass(isActive: boolean): string {
  return `flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
    isActive
      ? "bg-cyan-500/10 text-cyan-400 shadow-sm aura-border-cyan"
      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
  }`;
}

const tabLabelClass = "text-[10px] font-medium uppercase tracking-wider";
