#!/usr/bin/env node
/**
 * scripts/check-no-tracked-secret-env.mjs
 *
 * Pre-flight guard — fails `npm run build` (via the prebuild chain) if
 * `.env` exists at the workspace root AND contains a non-placeholder
 * value for JWT_SECRET or WEBHOOK_SECRET. The intent is to catch the
 * typo class `cp .env-from-prod .env && git add -f .env` AND any
 * accidental force-tracking of a real prod .env so a sketchy secret
 * never reaches a CI log, a build artefact, or a public repo.
 *
 * Why this lives as a Node script (not a `tests/*.test.ts`):
 *   - It is a BUILD-TIME gate, not a unit test. The failure mode
 *     surfaces in the deploy log as `Build failed`, not as a
 *     `npm test` red bar — different audience, different contract.
 *   - It is runnable independently: `npm run check:env` from any
 *     clean shell, before any other gate. Useful for local triage.
 *   - It depends only on `node:fs` and `node:path` — zero transitive
 *     deps, no tsx/interpreter needed at runtime.
 *
 * Exit codes:
 *   0  — clean. .env absent OR all watched keys are placeholder/empty.
 *   1  — FAIL. .env has a non-placeholder value for a watched key.
 *        The output prints ONLY length + first-4-char fingerprint;
 *        the raw value is NEVER echoed.
 *   2  — FAIL-CLOSED on I/O error (permission denied, weird encoding).
 *
 * Skip env var: `SKIP_SECRET_ENV_CHECK=1`. Documented as last-resort;
 * the user MUST read the rationale above the script before setting it.
 */

// `import.meta.url` is reliable across Node 20+ ESM. Use it for
// `fileURLToPath + dirname(dirname(...))` to derive the project root
// regardless of where node was invoked from (works when packaged
// into a Docker stage that pins cwd elsewhere).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = join(ROOT_DIR, ".env");

// Watched keys — the keys treated as "production-secret surface" by the
// boot guard (JWT_SECRET) and the HMAC layer
// in authMiddleware (WEBHOOK_SECRET for /api/webhook/* and
// /api/admin/import since cefb6b8). Adding BOOTSTRAP_ADMIN_PASSWORD
// here would ALSO be defended against leaks, but user scope is the two
// HMAC-shaped ones only; keep the surface narrow, let a future commit
// widen if the threat model shifts.
const WATCHED_KEYS = ["JWT_SECRET", "WEBHOOK_SECRET"];

// Public-known weak / placeholder values the project already uses as
// fallbacks. ANY of these are non-blocking signals — they are dev
// defaults that exist precisely to let contributors work without a
// real secret. The dev-fallback string below MUST be kept in lockstep
// with `const JWT_SECRET = process.env.JWT_SECRET || "<this>"` in
// Current Worker entry. Drift here would silently false-fail every
// dev-mode `npm run build` on the host machine.
const PLACEHOLDER_EXACT = new Set([
  "orbeat-dev-secret-change-in-production", // dev-fallback for JWT_SECRET
  "",                                       // explicitly empty
]);

// Substrings that mark any value as "still a placeholder, not a real
// production secret" — covers freeform placeholders like
// `<paste-here>`, `change-me`, `TODO`, `xxxxxxxxxx` even when the
// whole-line author wrote them in any case. Case-insensitive match.
const PLACEHOLDER_HINTS = [
  "<paste",
  "<your",
  "change-me",
  "change_me",
  "replace-me",
  "replace_me",
  "your-",
  "your_",
  "placeholder",
  "todo",
  "fixme",
  "xxxxxxxxxx",
  "xxxxxxxx",
  "example-secret",
  "sample-secret",
  "fake",
  "test-only",
];

/**
 * Returns true iff `rawValue` looks like a placeholder, not a real
 * production secret. Exact-set match first, then substring hint scan.
 * Quote-pair stripping (`"foo"` → `foo`) is handled BEFORE the check
 * so `JWT_SECRET="change-me"` works identically to `JWT_SECRET=change-me`.
 */
function isPlaceholder(rawValue) {
  const trimmed = (rawValue ?? "").trim().replace(/^["']|["']$/g, "");
  if (PLACEHOLDER_EXACT.has(trimmed)) return true;
  if (trimmed.length === 0) return true;
  const lower = trimmed.toLowerCase();
  return PLACEHOLDER_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Minimal .env parser — handles:
 *   1. KEY=value                   (bare)
 *   2. KEY="value with spaces"     (double-quoted, strip surrounding quotes)
 *   3. KEY='value with spaces'     (single-quoted, strip surrounding quotes)
 *   4. KEY=value # trailing comment (only on the ` #` delimiter, NOT
 *                                  a `#` inside a value like `KEY=#abc`,
 *                                  which is rare and we treat as-is)
 *   5. KEY=                        (empty, treated as placeholder)
 *   6. # comments and blank lines  (skipped)
 *
 * Multiline values (rare in JWT/webhook secrets; not produced by either
 * crypto.randomBytes nor base64url nor manual editing) are NOT
 * supported — we ignore continuation into the next line. Variable
 * expansion (`KEY=${OTHER}`) is NOT resolved; literal dollar-brace
 * values are treated as-is, so a `${DB_PASSWORD}` accidental paste
 * would still trip the gate unless the literal string matches a
 * placeholder hint. Fail-closed is the right default here.
 */
function parseEnvFile(contents) {
  const out = new Map();
  const lines = contents.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trimStart();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/i.test(key)) continue;
    let value = line.slice(eq + 1);
    // Strip a trailing inline comment ONLY when preceded by whitespace
    // (the .env de facto convention is `KEY=foo # comment`). A bare
    // `#` character at value-start (e.g. `KEY=#abc`) is preserved.
    const commentStart = value.indexOf(" #");
    if (commentStart !== -1) value = value.slice(0, commentStart);
    out.set(key, value);
  }
  return out;
}

function main() {
  // Escape hatch — last-resort only. Logged so an operator scanning
  // logs sees BOTH the skip and the rationale, not a silent slip.
  if (process.env.SKIP_SECRET_ENV_CHECK === "1") {
    console.warn(
      "[check-no-tracked-secret-env] WARNING: SKIP_SECRET_ENV_CHECK=1 — " +
        "the .env guard has been intentionally bypassed for this run. " +
        "Use this ONLY for controlled migrations; production deploys " +
        "should always trip on a leaked .env so the issue lands in the " +
        "deploy log instead of the public artifact."
    );
    process.exit(0);
  }

  if (!existsSync(ENV_PATH)) {
    console.log(
      "[check-no-tracked-secret-env] .env absent at " + ENV_PATH + " — clean."
    );
    process.exit(0);
  }

  let contents;
  try {
    contents = readFileSync(ENV_PATH, "utf8");
  } catch (err) {
    console.error(
      "[check-no-tracked-secret-env] FAIL-CLOSED: cannot read " +
        ENV_PATH +
        ". The guard refuses to proceed when the file is unreadable " +
        "so a permission/encoding surface cannot accidentally pass. " +
        "Original error: " +
        (err instanceof Error ? err.message : String(err))
    );
    process.exit(2);
  }

  // Defense-in-depth fail-closed on non-UTF8 / binary input. Node's
  // decoder (`readFileSync(path, "utf8")`) silently substitutes the
  // Unicode replacement character U+FFFD for invalid byte sequences
  // INSTEAD of throwing — so a `cp <binary> .env` typo (e.g. copying
  // a `.db`, an `.so`, or any non-text content into `.env`) would
  // otherwise exit 0 if its bytes don't happen to contain a
  // `JWT_SECRET=` literal. The header contract promises "weird
  // encoding → exit 2"; this check is the implementation of that
  // promise. Any presence of U+FFFD means the file is not a real
  // `.env` source file; refuse to proceed so the operator fixes the
  // root cause (the typo) instead of getting a misleading green light.
  if (contents.includes("\uFFFD")) {
    console.error(
      "[check-no-tracked-secret-env] FAIL-CLOSED: " +
        ENV_PATH +
        " is not a valid UTF-8 text file (decoder emitted U+FFFD " +
        "replacement characters). The guard treats a non-text `.env` " +
        "— e.g. from a `cp <binary> .env` typo — as a hard failure " +
        "even when no watched keys are present, so the operator sees " +
        "the typo instead of a misleading green light. Remove the " +
        "file or fix its encoding before rebuilding."
    );
    process.exit(2);
  }

  const parsed = parseEnvFile(contents);
  const leaks = [];
  for (const key of WATCHED_KEYS) {
    if (!parsed.has(key)) continue;
    const raw = parsed.get(key) ?? "";
    if (isPlaceholder(raw)) continue;
    leaks.push({
      key,
      length: raw.length,
      fingerprint: raw.slice(0, 4),
    });
  }

  if (leaks.length === 0) {
    console.log(
      "[check-no-tracked-secret-env] .env present but all watched keys " +
        "(JWT_SECRET, WEBHOOK_SECRET) are placeholder/empty — clean."
    );
    process.exit(0);
  }

  // FAIL — print structured diagnostic. NEVER echo the raw value.
  console.error(
    "\n═══════════════════════════════════════════════════════════════"
  );
  console.error(
    "[check-no-tracked-secret-env] FAIL — .env at the workspace root has a\n" +
      "        non-placeholder value for one or more watched keys. The guard\n" +
      "        refuses to start the build so the secret value cannot leak\n" +
      "        via CI logs, build artefacts, or accidentally-tracked grep\n" +
      "        of the deployed source tree."
  );
  console.error(
    "═══════════════════════════════════════════════════════════════"
  );
  for (const { key, length, fingerprint } of leaks) {
    console.error(
      `  ↳ ${key}: ${length} chars, starts with "${fingerprint}…"`
    );
  }
  console.error("");
  console.error("Fix paths:");
  console.error(
    "  1. If this is a mistake (you set a real value for local dev),\n" +
      "     replace the value with a placeholder (e.g. <paste-here>)\n" +
      "     and the gate will pass on the next run."
  );
  console.error(
    "  2. If .env was accidentally force-tracked (`git add -f .env`),\n" +
      "     remove it from the index with `git rm --cached .env`. The\n" +
      "     existing `.gitignore` already excludes it normally."
  );
  console.error(
    "  3. Skip this check entirely (for a controlled migration only)\n" +
      "     with `SKIP_SECRET_ENV_CHECK=1`. Default behavior is FAIL-\n" +
      "     CLOSED; the env var is the only opt-out and is loud in logs."
  );
  process.exit(1);
}

main();
