interface AuraBrandProps {
  /**
   * Default width. Square 1024×1024 PNG source (transparent background
   * for light theme) converted to WebP at 256w / 512w / 960w. The
   * height equals the width since the logo is square.
   *
   * `object-cover object-center` is kept for backwards compatibility
   * with square containers (Login, PWA install icon) — on a square
   * logo it's effectively a no-op, which is the correct behaviour.
   *
   * Responsive images: srcSet delivers 256w / 512w / 960w WebP
   * variants; the sizes attribute maps the Tailwind CSS breakpoint
   * ladder so the browser picks the smallest variant that covers the
   * displayed width at the current viewport.
   */
  size?: number;
  className?: string;
  /** Accessible label override; defaults to "AURA". */
  ariaLabel?: string;
  /**
   * High-priority image fetch. Set to `true` at the Login splash
   * and the persistent AppLayout hero (above-the-fold on first
   * paint). The PWA-pack raster is heavier than the rest of the
   * first-paint budget — on Sub-3G connections the lazy-load grace
   * window + decode delay can stall first-contentful-paint by
   * several hundred ms. `fetchpriority="high"` + `loading="eager"`
   * resolve that by hinting the network stack to race the raster
   * against the CSS bundle instead of waiting for the lazy-load
   * grace window. Default `false` is fine for off-screen consumers
   * (e.g. AuraIntro Splash, which follows the Login splash and
   * therefore inherits its in-memory image cache).
   */
  priority?: boolean;
}

/**
 * AURA in-app brand image — Login hero, AppLayout hero watermark,
 * AuraIntro splash.
 *
 * Replaces the prior inline-SVG composite + 2400 ms cinematic
 * choreography. Three call sites consume this same image element:
 *
 *   - LoginPage (192 px above-the-fold)
 *   - AppLayout hero watermark (960 px centred behind main column)
 *   - AuraIntro splash (960 px transient overlay, 600 ms fade)
 *
 * Same source URL everywhere: `public/brand-assets/AURA.png`. The
 * source raster is the PWA-pack icon used as both the in-app
 * brand mark AND the home-screen / OS-laundered install icon
 * (referenced by `index.html` `<link rel="apple-touch-icon">` +
 * the manifest icons). At the Login splash the raster dominates
 * the LCP window, so the `priority` prop is set at both
 * first-paint call sites (LoginPage + AppLayout hero). The splash
 * alone passes `false` because it follows the Login splash which
 * has already pulled the image into the browser's image cache.
 *
 * Single-source invariant: `tests/icon-assets.test.ts` asserts
 * that the favicon, apple-touch-icon, manifest icons, og:image,
 * twitter:image, and JSON-LD logo all resolve to this same file.
 * Editing those references in lock-step (or splitting into a
 * separate square variant for the install icon) will fail that
 * test — keep the single source.
 *
 * Plain URL: both the folder name (`/brand-assets/`) and the
 * filename (`AURA.png`) are space-free, so the URL is left
 * unencoded. Previously this component pointed at a space-named
 * ChatGPT-Image download that required percent-encoding the
 * spaces + comma; consolidating onto the PWA-pack raster lets us
 * drop the URL-encoding boilerplate AND the interim `public/brand-assets/ChatGPT Image...`
 * file (which had no other references and would otherwise ship as
 * an orphan into `dist/`).
 *
 * The SVG-specific CSS hooks stripped from `src/index.css`:
 *   - `@keyframes aura-intro-logo-show` (splash choreography)
 *   - `@keyframes aura-intro-wordmark-show` + `@keyframes aura-intro-glow-show`
 *   - `.aura-intro-logo`, `.aura-brand-wordmark`, `.aura-intro-glow`
 *   - `@keyframes aura-logo-orbit-breath`, `aura-logo-bar-pulse`, `aura-logo-sparkle-twinkle`
 *   - `.aura-logo-orbit`, `.aura-logo-equalizer rect`, `.aura-logo-sparkle`, `.aura-logo-static`
 * The AuraAMark families (the small "A" letter) are unaffected.
 */
export function AuraBrand({
  size = 240,
  className = "",
  ariaLabel = "AURA",
  priority = false,
}: AuraBrandProps) {
  return (
    <img
      // Responsive WebP: srcSet delivers the smallest variant that
      // covers the displayed width at each viewport, matching the
      // Tailwind CSS breakpoint ladder in AppLayout.tsx.
      //   <360px: 288px display → 256w variant (7 KB)
      //   360-639px: 320px → 512w variant (18 KB)
      //   640-767px: 384px → 512w variant (18 KB)
      //   768-1023px: 416px → 512w variant (18 KB)
      //   1024px+: 960px → 960w variant (50 KB)
      // Fallback src (no srcSet support): 512w covers mobile/tablet.
      src="/brand-assets/AURA-512w.webp"
      srcSet="/brand-assets/AURA-256w.webp 256w, /brand-assets/AURA-512w.webp 512w, /brand-assets/AURA-960w.webp 960w"
      sizes="(max-width: 359px) 18rem, (max-width: 639px) 20rem, (max-width: 767px) 24rem, (max-width: 1023px) 26rem, 60rem"
      width={size}
      height={size} // square logo (1024×1024)
      alt={ariaLabel}
      className={`block h-auto w-full max-w-full object-cover object-center select-none ${className}`}
      draggable={false}
      // The two speed hints are independent: `fetchpriority` tells
      // the network stack, `loading` tells the React scheduler.
      // Both apply together. Decode synchronously so the first
      // paint of the Login page is the raster, not the placeholder.
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
    />
  );
}
