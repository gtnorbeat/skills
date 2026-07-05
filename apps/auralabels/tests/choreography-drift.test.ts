/**
 * Choreography drift test.
 *
 * Validates that every @keyframes declaration in src/index.css has a
 * corresponding row in CHOREOGRAPHY.md §1 table, and vice versa.
 *
 * If this test fails:
 * 1. You added/removed a @keyframes in index.css → update CHOREOGRAPHY.md §1
 * 2. You updated CHOREOGRAPHY.md §1 → update @keyframes in index.css
 * 3. Both files are correct but counts drifted → audit with:
 *    grep -nE '^@keyframes' apps/auralabels/src/index.css
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CSS_PATH = path.resolve(__dirname, "../src/index.css");
const DOC_PATH = path.resolve(__dirname, "../CHOREOGRAPHY.md");

function countKeyframesInCss(content: string): Set<string> {
  const names = new Set<string>();
  const regex = /@keyframes\s+([\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    names.add(match[1]);
  }
  return names;
}

function countKeyframesInDoc(content: string): Set<string> {
  const names = new Set<string>();
  // Match §1 table rows: rows that contain a @keyframes name in the first
  // code block. The table format is `| N | \`name\` | ...`
  // We extract names from the §1 section between "§1." and "§2."
  const section1 = content.split("## §1.")[1]?.split("## §2.")[0];
  if (!section1) return names;

  // Match table rows with a keyframe name in backticks in column 2
  const rowRegex = /\|\s*\d+\s*\|[^|]*`([\w-]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(section1)) !== null) {
    names.add(match[1]);
  }
  return names;
}

function countInlineTailwindKeyframes(docContent: string): number {
  // §3 lists Tailwind built-in utilities (animate-spin, -pulse, -ping) that
  // aren't @keyframes in index.css. We count them separately to confirm
  // the doc is accurate about what's "not in index.css".
  const section3 = docContent.split("## §3.")[1]?.split("## §4.")[0];
  if (!section3) return 0;
  // Match | `animate-<name>` | ... rows
  const rowRegex = /\|\s*`animate-([\w-]+)`/g;
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(section3)) !== null) {
    names.add(match[1]);
  }
  return names.size;
}

describe("Choreography drift", () => {
  let cssContent: string;
  let docContent: string;

  beforeAll(() => {
    cssContent = fs.readFileSync(CSS_PATH, "utf-8");
    docContent = fs.readFileSync(DOC_PATH, "utf-8");
  });

  it("CSS and CHOREOGRAPHY.md §1 reference the same @keyframes", () => {
    const cssKeyframes = countKeyframesInCss(cssContent);
    const docKeyframes = countKeyframesInDoc(docContent);

    // Keyframes in CSS but not in doc → doc needs updating
    const missingFromDoc = [...cssKeyframes].filter((k) => !docKeyframes.has(k));
    // Keyframes in doc but not in CSS → CSS was changed without updating doc
    const missingFromCss = [...docKeyframes].filter((k) => !cssKeyframes.has(k));

    if (missingFromDoc.length > 0) {
      throw new Error(
        `@keyframes in CSS but missing from CHOREOGRAPHY.md §1: ${missingFromDoc.join(", ")}. ` +
          "Add a row to §1 for each new keyframe.",
      );
    }
    if (missingFromCss.length > 0) {
      throw new Error(
        `@keyframes in CHOREOGRAPHY.md §1 but missing from CSS: ${missingFromCss.join(", ")}. ` +
          "Either add the @keyframes to index.css or remove the stale row from §1.",
      );
    }

    expect(cssKeyframes.size).toBe(docKeyframes.size);
    expect(cssKeyframes.size).toBeGreaterThan(0);
  });

  it("§3 Tailwind utilities are correctly catalogued (not in index.css)", () => {
    const cssKeyframes = countKeyframesInCss(cssContent);
    const tailwindCount = countInlineTailwindKeyframes(docContent);

    // These should NOT be @keyframes in index.css
    const tailwindKeyframes = ["spin", "pulse", "ping"];
    for (const name of tailwindKeyframes) {
      expect(cssKeyframes.has(name)).toBe(false);
    }

    expect(tailwindCount).toBe(tailwindKeyframes.length);
  });

  it("@keyframes count is exactly what we expect today", () => {
    const cssKeyframes = countKeyframesInCss(cssContent);
    // Snapshot test — if you add/remove a @keyframes, update this number
    // AND update CHOREOGRAPHY.md §1. Both must stay in lockstep.
    expect(cssKeyframes.size).toBe(9);
  });
});
