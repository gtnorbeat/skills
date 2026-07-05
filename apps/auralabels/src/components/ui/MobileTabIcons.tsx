import type { ReactNode } from "react";

interface MobileTabIconProps {
  /** Pixel size for both width and height (matches MobileTabBar's
   *  20-px footprint convention). Default 20. */
  size?: number;
  className?: string;
  /**
   * Accessible label override. When supplied, the rendered SVG carries
   * `role="img"` + `aria-label=` so screen readers announce it.
   * When omitted (the default for tab-bar glyphs), the SVG is
   * `aria-hidden="true"` — the surrounding NavLink button label
   * ("Home" / "AI" / "More") already names the destination.
   */
  ariaLabel?: string;
}

/**
 * MOBILE_FIRST Phase 2 — MobileTabIcons.tsx reserves the bottom-tab's
 * tab-bar-specific glyphs only.
 *
 * The four primary tabs (Dashboard / Artists / Releases / AI) import
 * the canonical `SidebarIcons.tsx` + `AuraAMark.tsx` family directly
 * from `MobileTabBar.tsx`. Those identical glyphs drive the desktop
 * Sidebar's nav too, so users see the same icon language across
 * sidebar drawer + bottom-tab at every viewport.
 *
 * The `More` glyph lives here because the Sidebar drawer doesn't have
 * a "More" affordance of its own — the bottom-tab IS the surface that
 * surfaces long-tail navigation destinations through the drawer, so
 * the symbol is exclusive to that intersection.
 *
 * Stroke width: 1.75 (a hair thicker than SidebarIcons' 1.5) so the
 * three horizontal lines stay legible at the bottom-tab's 20-px
 * footprint — the thinner Sidebar stroke can read as too delicate at
 * the smaller navigation window. Same `vector-effect="nonScalingStroke"`
 * reasoning as `SidebarIcons` so the rendered thickness is consistent
 * across any user-applied scale.
 */
function IconBase({
  children,
  size = 20,
  className = "",
  ariaLabel,
}: MobileTabIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="nonScalingStroke"
      strokeWidth={1.75}
      className={className}
      {...(ariaLabel
        ? { role: "img" as const, "aria-label": ariaLabel }
        : { "aria-hidden": "true" })}
    >
      {children}
    </svg>
  );
}

/**
 * Three horizontal lines — universal "more" / menu-expansion glyph.
 * Spaced at 6 / 12 / 18 y so the lines feel balanced inside the 24 × 24
 * viewBox; matches the visual weight of the lucide-react `Menu` icon
 * for muscle-memory continuity with mobile-web idioms.
 */
export function MoreIcon(props: MobileTabIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  );
}
