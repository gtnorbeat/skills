/**
 * E2E test: prefers-reduced-motion kills stagger delays.
 *
 * Uses Playwright's CDP-based `page.emulateMedia()` to toggle the
 * `prefers-reduced-motion` CSS media feature and verifies that:
 *
 *  1. **Without** reduced motion — `.aura-stagger-6` applies the
 *     expected 480ms `animation-delay`.
 *  2. **With** reduced motion — the `@media (prefers-reduced-motion: reduce)`
 *     `!important` override kicks in, collapsing `animation-delay` to
 *     `0.01ms` so all staggered items appear simultaneously.
 *
 * This is a true rendering-level test: the CDP Emulation API triggers
 * browser-level CSS media feature re-evaluation, not a JavaScript mock.
 */
import { test, expect } from "@playwright/test";

/**
 * Parse a CSS duration value ("0.48s", "400ms", "1e-05s") into milliseconds.
 * Handles both seconds and milliseconds, with or without scientific notation.
 */
function parseDuration(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("ms")) {
    return parseFloat(trimmed) || 0;
  }
  if (trimmed.endsWith("s")) {
    return (parseFloat(trimmed) || 0) * 1000;
  }
  return 0;
}

test.describe("prefers-reduced-motion stagger override", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to any page that loads index.css (login is public and
    // uses the same global stylesheet as every other route).
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test("without reduced motion, .aura-stagger-6 animation-delay is 480ms", async ({ page }) => {
    const delay = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "aura-enter-fade-up aura-stagger-6";
      document.body.appendChild(el);
      const cs = window.getComputedStyle(el);
      // Return both delay and duration so we can confirm the entry
      // animation itself is also applied.
      return {
        animationDelay: cs.animationDelay,
        animationDuration: cs.animationDuration,
        animationName: cs.animationName,
      };
    });

    expect(delay.animationDelay).toBe("0.48s");
    expect(delay.animationDuration).toBe("0.4s");
    expect(delay.animationName).toContain("aura-fade-up");
  });

  test("with reduced motion via CDP, animation-delay collapses to 0.01ms", async ({ page }) => {
    // Create the element BEFORE toggling reduced motion so we can
    // confirm the override applies retrospectively to existing DOM.
    const delayBefore = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "aura-enter-fade-up aura-stagger-6";
      document.body.appendChild(el);
      return window.getComputedStyle(el).animationDelay;
    });
    // Sanity-check the baseline before toggling.
    expect(delayBefore).toBe("0.48s");

    // Toggle prefers-reduced-motion via CDP Emulation API.
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Wait a frame for the CSS cascade to re-evaluate.
    await page.waitForTimeout(100);

    const delayAfter = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".aura-stagger-6");
      // Force reflow to ensure computed styles are fresh.
      void el!.offsetHeight;
      const cs = window.getComputedStyle(el!);
      return {
        animationDelay: cs.animationDelay,
        animationDuration: cs.animationDuration,
        animationIterationCount: cs.animationIterationCount,
      };
    });

    // The !important override should collapse both delay and duration.
    // Note: browsers report very short times in seconds with scientific
    // notation (e.g. "1e-05s" = 0.00001s = 0.01ms) or in milliseconds
    // ("0.01ms") depending on the engine, so we parse and compare numerically.
    const delayMs = parseDuration(delayAfter.animationDelay);
    const durationMs = parseDuration(delayAfter.animationDuration);
    expect(delayMs).toBeLessThanOrEqual(0.1); // ≤ 0.1ms is effectively instant
    expect(durationMs).toBeLessThanOrEqual(0.1);
    // Infinite loops (aura-float) should be clamped to 1 iteration.
    expect(delayAfter.animationIterationCount).toBe("1");
  });

  test("new elements created after reduced-motion toggle also respect the override", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);

    const delay = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "aura-enter-fade-up aura-stagger-6";
      document.body.appendChild(el);
      void el.offsetHeight; // force reflow
      return window.getComputedStyle(el).animationDelay;
    });

    const delayMs = parseDuration(delay);
    expect(delayMs).toBeLessThanOrEqual(0.1); // ≤ 0.1ms is effectively instant
  });
});
