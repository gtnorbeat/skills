import type { ReactNode } from "react";

interface SidebarIconProps {
  /** Pixel size for both width and height. Drives the SVG display box.
   *  Default 16 — matches the Sidebar `w-5` icon column at typical use. */
  size?: number;
  className?: string;
  /**
   * Accessible label override. When supplied, the rendered SVG carries
   * `role="img"` + `aria-label=` so screen readers announce it.
   * When omitted (the common case for Sidebar nav items), the SVG is
   * `aria-hidden="true"` — the surrounding NavLink label text already
   * names the destination, so a second announcement would be noise.
   */
  ariaLabel?: string;
}

/**
 * Shared SVG wrapper so every sidebar icon renders with the same stroke
 * spec. Using a single component here is what enforces visual coherence:
 * if a designer wants to bump stroke-width or cap shape project-wide
 * they edit this one place and the whole family updates together.
 *
 * `vectorEffect="nonScalingStroke"` is the key trick — it pins the
 * rendered stroke thickness to the SVG attribute value regardless of
 * how the element is scaled by `size`. So at 14 px display or 64 px
 * display the stroke is exactly 1.5 px either way. Matches the same
 * approach AuraAMark uses for its rings (CSS `border-width: 1.5px`
 * on an absolute-pixel scale).
 */
function IconBase({
  children,
  size = 16,
  className = "",
  ariaLabel,
}: SidebarIconProps & { children: ReactNode }) {
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
      strokeWidth={1.5}
      className={className}
      {...(ariaLabel
        ? { role: "img" as const, "aria-label": ariaLabel }
        : { "aria-hidden": "true" })}
    >
      {children}
    </svg>
  );
}

// ── Lucide-style outline icons ──────────────────────────────────────────
// Each icon below is a 24×24 viewBox drawing that reads unambiguously
// at 14–16 px chrome sizes. Geometry is intentionally minimal so the
// family stays visually consistent at any size.

// Four-quadrant grid with one filled accent (the bottom-left "you are
// here" cell) — reads as dashboard / overview panel.
export function DashboardIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

// Artist = head + shoulders silhouette. Centered head circle + curved
// torso path below it.
export function ArtistsIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.5 3.13-6 7-6s7 2.5 7 6" />
    </IconBase>
  );
}

// Vinyl record: outer disc edge + label ring center + axis dot. The
// smallest detail (the center dot) is what sets this apart from a
// generic circle glyph.
export function ReleasesIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

// Document with signature line + small cursive hook — reads as a
// signed paper / contract at 14 px.
export function RightsIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <path d="M14 15.5c0-1.5 2-1 2-2.5s-1.5-1.5-1.5 0" />
    </IconBase>
  );
}

// Inbox tray: bottom tray + downward envelope inside. Two semantic
// marks (tray + envelope) subordinate to a single shape — the document
// arriving into the slot.
export function DemoInboxIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 15v3h16v-3" />
      <path d="M4 9l8 5 8-5" />
      <rect x="4" y="5" width="16" height="10" rx="1" />
    </IconBase>
  );
}

// Megaphone cone + 2 emanating sound waves to the right. Reads as
// outreach/broadcast at 16 px. Note the waves are deliberately not on
// the left side — icon stays compact inside the w-5 column.
export function PromoIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 11l14-6v14L3 13v-2z" />
      <path d="M17 19v-4" />
      <path d="M21 9c.7 1.5.7 3.5 0 5" />
      <path d="M19.5 7.5c1.45 2.5 1.45 5.5 0 8" />
    </IconBase>
  );
}

// Code brackets: < /> pattern. The slash intentionally cuts diagonally
// through the centre as an apex (subtle but consistent with code-editor
// toolbars where this glyph means "developer tools" / "source").
export function ContentIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 8l-4 4 4 4" />
      <path d="M17 8l4 4-4 4" />
      <path d="M14 4l-4 16" />
    </IconBase>
  );
}

// Date grid: header band + 2×2 cell separators. Reads as calendar even
// at 14 px because the header + a single row of cells is enough signal.
export function CalendarIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M9 10v10" />
      <path d="M15 10v10" />
      <path d="M3 15h18" />
    </IconBase>
  );
}

// Three ascending bars + upward chevron arrow — a chart-up glyph that
// unambiguously says "revenue growing" without needing a $ sign (which
// would clash with project aesthetics and is currency-specific).
export function RevenueIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
      <path d="M14 8l4-4 4 4" />
    </IconBase>
  );
}

// Radar / insight: outer ring on top of short radial beams pointing
// inward to the center. Reads as "scanning the horizon" / "campaign
// intelligence" without literally drawing a sun.
export function CampaignIntelligenceIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M19.07 4.93l-1.41 1.41" />
      <path d="M22 12h-2" />
      <path d="M19.07 19.07l-1.41-1.41" />
      <path d="M12 22v-2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M2 12h2" />
      <path d="M4.93 4.93l1.41 1.41" />
    </IconBase>
  );
}

// Settings gear: symmetric 12-tooth spline + center hole. The path is
// large but the cubic bezier asymmetry is invisible at 14 px — what the
// user actually sees is "circle with notches = gear".
export function SettingsIcon(props: SidebarIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </IconBase>
  );
}
