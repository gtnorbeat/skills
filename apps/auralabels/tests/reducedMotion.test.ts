/**
 * Reduced-motion CSS test.
 *
 * Verifies that the `@media (prefers-reduced-motion: reduce)` block in
 * `src/index.css` correctly overrides `animation-delay` to neutralise
 * the stagger delay helpers (.aura-stagger-1 through -6).
 *
 * Without this override, reduced-motion users would still experience
 * sequential 80-480ms delays between card entries (just without the
 * fade animation), which can be disruptive for users with vestibular
 * or motion sensitivity.
 *
 * Reads the CSS source directly (no jsdom required) and asserts the
 * rule text is present — a source-level invariant caught by CI without
 * browser rendering.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CSS_PATH = path.resolve(__dirname, "../src/index.css");

function readCss(): string {
  return fs.readFileSync(CSS_PATH, "utf-8");
}

/**
 * Extract the body of the first @media (prefers-reduced-motion: reduce)
 * block from the CSS source by tracking brace nesting depth.
 */
function getMotionReduceBlock(css: string): string | null {
  const blockStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
  if (blockStart === -1) return null;

  const braceOpen = css.indexOf("{", blockStart);
  if (braceOpen === -1) return null;

  let depth = 0;
  for (let i = braceOpen; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        return css.slice(braceOpen + 1, i);
      }
    }
  }
  return null;
}

describe("prefers-reduced-motion", () => {
  const css = readCss();
  const blockBody = getMotionReduceBlock(css);

  it("contains a @media (prefers-reduced-motion: reduce) block", () => {
    expect(blockBody).not.toBeNull();
  });

  it("overrides animation-delay to neutralise stagger delays", () => {
    expect(blockBody!).toContain("animation-delay: 0.01ms !important");
  });

  it("overrides animation-duration to near-instant", () => {
    expect(blockBody!).toContain("animation-duration: 0.01ms !important");
  });

  it("stops infinite animations (aura-float) via animation-iteration-count", () => {
    expect(blockBody!).toContain("animation-iteration-count: 1 !important");
  });

  it("overrides transition-duration for hover effects", () => {
    expect(blockBody!).toContain("transition-duration: 0.01ms !important");
  });

  it("disables smooth scrolling", () => {
    expect(blockBody!).toContain("scroll-behavior: auto !important");
  });

  it("removes noise-grain texture from body", () => {
    expect(blockBody!).toContain("background-image: none !important");
  });
});

describe("stagger delay helpers", () => {
  const css = readCss();

  it("define .aura-stagger-1 through -6 at 80ms increments", () => {
    const delays = [80, 160, 240, 320, 400, 480];
    for (let i = 1; i <= 6; i++) {
      expect(css).toContain(`.aura-stagger-${i} { animation-delay: ${delays[i - 1]}ms; }`);
    }
  });

  it("are overridden by !important in the reduced-motion block", () => {
    const blockBody = getMotionReduceBlock(css);
    // Both the stagger class and the override must exist — the CSS
    // cascade ensures !important in the media query beats the class.
    expect(css).toMatch(/\.aura-stagger-\d+ \{ animation-delay: \d+ms; \}/);
    expect(blockBody!).toMatch(/\*[^}]*animation-delay: 0\.01ms !important/);
  });
});

describe("entry animation keyframes", () => {
  const css = readCss();

  it("defines aura-enter-fade-up class", () => {
    expect(css).toContain(".aura-enter-fade-up");
  });

  it("defines @keyframes aura-fade-up with translateY motion", () => {
    expect(css).toContain("@keyframes aura-fade-up");
    expect(css).toContain("transform: translateY(20px)");
    expect(css).toContain("transform: translateY(0)");
  });
});
