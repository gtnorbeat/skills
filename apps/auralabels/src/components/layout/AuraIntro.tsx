import { useEffect, useState } from "react";
import { AuraBrand } from "@/components/ui/AuraBrand";

interface AuraIntroProps {
  /**
   * When true, the splash plays; when false, the overlay unmounts
   * IMMEDIATELY (synchronous reset of both mounted + visible flags)
   * and the AppLayout hero watermark becomes the sole visible brand
   * image.
   */
  active: boolean;
  /**
   * Called when the splash animation has fully completed. AppLayout
   * flips the hero from `pending` to `settled` so the wrapped image
   * is at its rest opacity without an intermediate reveal fade.
   */
  onDone: () => void;
}

/**
 * AURA brand reveal splash — a 600 ms PNG fade-in/fade-out that
 * plays once across the login -> dashboard boundary.
 *
 * Replaces the prior 2400 ms multi-keyframe SVG choreography
 * (`@keyframes aura-intro-logo-show` + `aura-intro-wordmark-show` +
 * `aura-intro-glow-show` etc.). With the SVG geometry replaced by
 * a static raster lookup against the AURA logo
 * (responsive WebP: 256w/512w/960w via AuraBrand's srcSet), the splash no longer needs the
 * "logo first, then the name drops in" cinematic beat — a single
 * fade-in/out reads cleanly against the dashboard-mount handoff.
 *
 * State machine (TOTAL_MS = 600 ms wall-clock):
 *   - t=0:    mounted=true, visible=false (opacity 0). rAF ->
 *            visible=true on the next paint (opacity 1, fade-in
 *            via Tailwind transition-opacity 300 ms).
 *   - t=600:  setVisible(false) -> opacity 0 fade-out begins
 *            (300 ms Tailwind transition-opacity).
 *   - t=900:  setMounted(false), onDone(). AppLayout's heroState
 *            flips to "settled" -> the static hero is at its
 *            rest opacity (round-and-coherent handoff).
 *
 * Logout-mid-splash handling (the `active` prop flipping false
 * before the splash plays out, e.g. user clicks Sign Out on the
 * Login page while AuraIntro is still mounted):
 *   - Early-return at the top of the effect, but BEFORE that,
 *     synchronously reset `mounted(false)` + `visible(false)` so
 *     the wrapper unmounts on the same commit. Otherwise the
 *     brand image lingers over an already-empty login page for
 *     up to 900 ms.
 *   - BOTH timers (the fade-out trigger at 600 ms AND the unmount
 *     at 900 ms) are tracked in closure variables and BOTH are
 *     cleared in the effect cleanup. Without the inner-capture
 *     of the unmount timer, a logout-mid-splash races the
 *     unmount timeout and `onDone()` fires against a stale
 *     closure (the user has already signed out, so the next
 *     heroState flip should be `settled`, not anything else).
 *
 * Reduced-motion: the global `prefers-reduced-motion` block at
 * the top of `src/index.css` collapses every transition to
 * 0.01 ms, so reduced-motion users see the wrapper flip
 * opacity instantly. The 600 ms wall-clock window is preserved
 * so the React unmount lifecycle stays predictable.
 */
export function AuraIntro({ active, onDone }: AuraIntroProps) {
  const [mounted, setMounted] = useState(active);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      // Synchronous reset so a logout-mid-splash unmounts the
      // wrapper on the same React commit as the prop flip;
      // neither the fade-out nor the unmount timers are running
      // on this branch so no further cleanup is needed here.
      setMounted(false);
      setVisible(false);
      return;
    }
    setMounted(true);
    // rAF -> next paint -> fade-in starts. Without rAF, the
    // mount + state flip coalesce into one commit and Tailwind's
    // transition-opacity doesn't fire.
    let fadeInHandle = 0;
    fadeInHandle = requestAnimationFrame(() => setVisible(true));

    const TOTAL_MS = 600;
    const fadeOutHandle = window.setTimeout(() => {
      setVisible(false);
      // Allow the 300 ms fade-out to complete before unmount so
      // the user doesn't see the wrapper vanish abruptly mid-fade.
      unmountHandle = window.setTimeout(() => {
        setMounted(false);
        onDone();
      }, 300);
    }, TOTAL_MS);
    let unmountHandle: number | undefined;

    return () => {
      cancelAnimationFrame(fadeInHandle);
      window.clearTimeout(fadeOutHandle);
      if (unmountHandle !== undefined) window.clearTimeout(unmountHandle);
    };
  }, [active, onDone]);

  if (!mounted) return null;

  return (
    // Centred wrapper at the same `z-[60]` overlay tier the prior
    // splash used, but no `mix-blend-screen` (the SVG mark
    // composited additively over the dark bg; the raster lookup
    // is opaque so we just stack the wrapper over the page).
    // The wrapper itself stays at opacity 1; only the `visible`
    // state on the inner div drives the fade. Keeping fade logic
    // on a single child means the wrapper's `z-[60]` is set
    // unconditionally and the unmount path can be invoked from
    // either `mounted` or `visible` without z-index thrash.
    <div
      aria-hidden="true"
      className="aura-intro pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-white/70"
    >
      <div
        className={`h-auto transition-opacity duration-300 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <AuraBrand
          size={960}
          ariaLabel=""
          className="h-auto w-72 min-[360px]:w-80 sm:w-[24rem] md:w-[26rem] lg:w-[60rem]"
          // Splash is OFF the first-paint critical path (Login
          // already pulled the same image), so no high-priority
          // fetch hint here.
        />
      </div>
    </div>
  );
}
