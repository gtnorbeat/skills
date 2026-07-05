import type { CSSProperties } from "react";

export type AuraVariant = "brand" | "idle" | "thinking" | "result";

interface AuraAMarkProps {
  /** Pixel size for both width and height (the box the rings orbit around). */
  size?: number;
  className?: string;
  /** Accessible label override; defaults to "AURA". */
  ariaLabel?: string;
  /**
   * Colour variant driving the entire palette via `currentColor`. Default
   * `"brand"` (cyan). The other three variants are pre-wired so the
   * per-AI-state wiring (green/amber/magenta) can be added later without
   * an API change. Currently only "brand" is exercised at call-sites.
   */
  variant?: AuraVariant;
}

/**
 * AURA "A" — small contextual sub-icon for AI surfaces.
 *
 * Composition: a single Ethnocentric "A" character at ~85 % of the box,
 * centred via inline-flex. `currentColor` drives the palette so the
 * `variant` prop (or any parent `text-*` colour utility) tints everything.
 *
 * Used in:
 *   1. The "AI Assistant" nav item in the left Sidebar.
 *   2. The toggle button in the Header that opens / closes the persistent
 *      AI Assistant rail.
 *
 * NOT the brand mark — AuraLogo.tsx carries brand identity at the bigger
 * sizes (the orbital ellipse + equalizer + sparkle NativeLogo). AuraAMark
 * is the contextual sub-icon: at the 14–16 px chrome sizes the bare
 * letter signals "this is the AI area" without competing visually with
 * the larger brand mark.
 *
 * Static. No motion (the previous orbital-ring animation was rolled back
 * after visual review — the rotation read as busy/distracting at small
 * sizes; a single tinted glyph is calmer in the chrome).
 */
export function AuraAMark({
  size = 16,
  className = "",
  ariaLabel = "AURA",
  variant = "brand",
}: AuraAMarkProps) {
  // Letter is sized to ~85% of the box so the rings have visible breathing
  // room. Ethnocentric Light at this scale sits well-centred relative to
  // the box when line-height:1 + inline-flex: center are both set.
  const fontPx = Math.round(size * 0.85);
  const style: CSSProperties = { width: size, height: size, fontSize: fontPx };
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      data-variant={variant}
      style={style}
      className={`aura-a-mono ${className}`}
    >
      A
    </span>
  );
}
