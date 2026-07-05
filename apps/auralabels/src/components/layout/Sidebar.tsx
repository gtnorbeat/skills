import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { AuraLogo } from "../ui/AuraLogo";
import { AuraAMark } from "../ui/AuraAMark";
import type { AuraVariant } from "../ui/AuraAMark";
import {
  DashboardIcon,
  ArtistsIcon,
  ReleasesIcon,
  RightsIcon,
  DemoInboxIcon,
  PromoIcon,
  ContentIcon,
  CalendarIcon,
  RevenueIcon,
  CampaignIntelligenceIcon,
  SettingsIcon,
} from "../ui/SidebarIcons";

interface NavItem {
  id: string;
  label: string;
  icon: string | ReactNode;
  path: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "core",
    label: "Core",
    items: [
      { id: "dashboard", label: "Dashboard", icon: <DashboardIcon size={16} className="shrink-0" />, path: "/" },
      { id: "ai-assistant", label: "AI Assistant", icon: <AuraAMark size={16} className="shrink-0" />, path: "/ai" },
    ],
  },
  {
    id: "roster",
    label: "Roster & Rights",
    items: [
      { id: "artists", label: "Artists", icon: <ArtistsIcon size={16} className="shrink-0" />, path: "/artists" },
      { id: "releases", label: "Releases", icon: <ReleasesIcon size={16} className="shrink-0" />, path: "/releases" },
      { id: "contracts", label: "Rights & Contracts", icon: <RightsIcon size={16} className="shrink-0" />, path: "/contracts" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "demo-inbox", label: "Demo Inbox", icon: <DemoInboxIcon size={16} className="shrink-0" />, path: "/demo-inbox" },
      { id: "promo", label: "Promo Campaigns", icon: <PromoIcon size={16} className="shrink-0" />, path: "/promo" },
      { id: "content", label: "Content Engine", icon: <ContentIcon size={16} className="shrink-0" />, path: "/content" },
      { id: "calendar", label: "Calendar", icon: <CalendarIcon size={16} className="shrink-0" />, path: "/calendar" },
      { id: "revenue", label: "Revenue", icon: <RevenueIcon size={16} className="shrink-0" />, path: "/revenue" },
    ],
  },
  {
    id: "system",
    label: "Insights & System",
    items: [
      { id: "campaigns", label: "Campaign Intelligence", icon: <CampaignIntelligenceIcon size={16} className="shrink-0" />, path: "/campaigns" },
      { id: "settings", label: "Settings", icon: <SettingsIcon size={16} className="shrink-0" />, path: "/settings" },
    ],
  },
];

interface SidebarProps {
  onClose?: () => void;
  /**
   * Optional callback forwarded from AppLayout so the sidebar can offer a
   * visible, always-reachable Sign out button in the footer. Matches the
   * Settings Session card handler: confirm() before invoking. When absent
   * (e.g. an isolated Sidebar test mount) the footer renders only the
   * version note — no Sign out button.
   */
  onSignOut?: () => void;
  /**
   * Live AI activity tint. Forwarded to the AuraAMark next to the
   * "AI Assistant" nav item so the icon tints green / amber /
   * fuchsia in sync with the rail's generation state. Undefined
   * falls back to the AuraAMark's default cyan ("brand") so
   * un-wired contexts look the same as before.
   */
  aiStatus?: Exclude<AuraVariant, "brand">;
  /**
   * Sidebar edge context — "left" (default) renders the panel with
   * a right-side border that meets the main column; "right" flips it
   * to a left-side border when the Sidebar is on the right of the
   * viewport (after a swap). Driven by AppLayout's `isSwapped` so the
   * divider line always sits at the visible edge between the panel
   * and the main column, independent of which side the panel sits on.
   */
  side?: "left" | "right";
  /**
   * Swap callback — toggles Sidebar <-> AI rail positions in
   * AppLayout's parent flex row. Invoked by the Swap Layout button in
   * the Sidebar footer; absent on isolated Sidebar test mounts where
   * the swap machinery isn't wired up.
   */
  onSwap?: () => void;
}

export function Sidebar({ onClose, onSignOut, aiStatus, side = "left", onSwap }: SidebarProps) {
  // Sign out is rendered in the footer for discoverability — matches the
  // classic web-app mental model and stays always-visible on both the
  // desktop sidebar and the mobile drawer. The Header chip dropdown AND
  // the Settings > Session card still have their own sign-out entries;
  // three redundant paths by design.
  const handleSignOutClick = () => {
    if (!onSignOut) return;
    if (!confirm("Sign out of AURA on this device?")) return;
    onSignOut();
  };
  return (
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      className={`flex h-full w-full max-w-[16rem] flex-col ${side === "right" ? "border-l" : "border-r"} border-black/20 bg-[#e4dfd8]`}
    >
      {/* Brand lockup at the top of the sidebar — left-aligned identity
          pair (logo + AURA wordmark). Sized naturally by py-4 sm:py-5 +
          logo size=36 = 68 / 76 px. The Dashboard Hero is now its own
          free-height centered band, so no min-h parity coupling here. */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-black/20 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <AuraLogo size={36} ariaLabel="AURA brand mark" className="shrink-0" />
          <h1 className="font-display text-xl leading-none tracking-[0.14em] text-zinc-900">
            AURA
          </h1>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-colors xl:hidden"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.id} className={groupIdx > 0 ? "mt-5" : ""}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/"}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-cyan-500/10 text-cyan-400 shadow-sm aura-border-cyan"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          aria-hidden="true"
                          className={`w-5 text-center text-sm ${
                            isActive ? "text-cyan-400" : "text-zinc-400"
                          }`}
                        >
                          {/* The AI Assistant nav item is the only one
                              whose icon carries live AI state, so we
                              special-case it here. Other items keep
                              their static emoji glyph + the parent's
                              text-cyan-400 / text-zinc-600 colour rule. */}
                          {item.id === "ai-assistant"
                            ? <AuraAMark size={16} className="shrink-0" variant={aiStatus ?? "brand"} />
                            : item.icon}
                        </span>
                        <span>{item.label}</span>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — the Sign out button stays always-visible (desktop
          sidebar + mobile drawer) so the only destructive action
          stays reachable. The Swap Layout button is now desktop-only
          (the Header ⇄ on the mobile drawer handles the same toggle).
          Both had min-h-[44px] for the touch-target rule; the swap
          button on mobile is suppressed by `hidden flex` so it never
          appears twice. */}
      <div className="flex-shrink-0 border-t border-black/20 px-3 py-3">
        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            className="mb-2 hidden w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-xs font-semibold text-cyan-300 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/15 hover:text-cyan-200 min-h-[44px] lg:flex"
            aria-label="Swap sidebar side"
            title="Swap which side the Sidebar and AI rail sit on"
          >
            <span aria-hidden="true">⇄</span>
            Swap layout
          </button>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={handleSignOutClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300 transition-all hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-200 min-h-[44px]"
            aria-label="Sign out of AURA"
          >
            <span aria-hidden="true">⏻</span>
            Sign out
          </button>
        )}
        <p className="mt-3 text-center text-[10px] text-zinc-400">v1.0 • Private</p>
      </div>
    </aside>
  );
}
