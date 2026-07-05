interface AuraLogoProps {
  /** Pixel size for both width and height (the 36 px Sidebar mount). */
  size?: number;
  className?: string;
  /** Accessible label override; defaults to "AURA". */
  ariaLabel?: string;
}

/**
 * AURA brand mark for chrome lockups (Sidebar header at 36 px).
 *
 * Replaces the prior inline-SVG geometry block (orbital ring +
 * equalizer + sparkle + animated ambient breath). The Sidebar chrome
 * is now driven by a single raster lookup against the user-supplied
 * PWA-pack file `public/brand-assets/AURA.png` — same image the OS
 * reads for /apple-touch-icon and the favicon, so the Sidebar mark
 * and the home-screen icon stay in register pixel-for-pixel.
 *
 * The source raster is square (1024×1024) with a centred logo mark.
 * The Sidebar mount is 36 px square, so the entire logo fits at
 * cover — no cropping needed.
 *
 * `src="/brand-assets/AURA.png"` is canonical; the folder name has
 * no space so the URL is left unencoded.
 *
 * The SVG-specific CSS hooks in `src/index.css`
 * (`.aura-logo-orbit`, `.aura-logo-equalizer rect`,
 * `.aura-logo-sparkle`, `.aura-logo-static`) are dead-code. The
 * AuraAMark families (the small "A" letter) are unaffected and keep
 * their `.aura-a-mono` rules.
 */
export function AuraLogo({
  size = 32,
  className = "",
  ariaLabel = "AURA",
}: AuraLogoProps) {
  // object-cover object-center crops the landscape source to the
  // square 36 px box without letterbox bands. The orbit sits at the
  // visual centre of the source raster, so the wordmark on either
  // side falls outside the 1:1 frame at this size — exactly the
  // chrome-lockup composition we want.
  return (
    <img
      src="/brand-assets/AURA-256w.webp"
      width={size}
      height={size}
      alt={ariaLabel}
      className={`block object-cover object-center select-none ${className}`}
      draggable={false}
    />
  );
}
