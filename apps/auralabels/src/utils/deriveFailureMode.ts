/**
 * Pure derivation from the cold-boot Promise.race outcome into the
 * tri-state UI mode the Dashboard paints once the race settles.
 *
 * ## Why this lives in a utility
 *
 * The Dashboard component used to co-locate this logic with the
 * state setters inside the Promise.race `.then` handler, which made
 * the rule easy to drift on: ten section slices, three thresholds
 * (all-failed / partial / all-succeeded-but-empty), and a
 * documented semantic shift away from the previous
 * "active-campaigns-only" filter. Pulling the rule out into a
 * standalone pure function exposes it as a black box that any
 * caller (REPL, a future unit-test framework, the Revenue / Calendar
 * pages if they ever want the same post-load UX mode) can exercise
 * directly, without needing to mount React + the ToastProvider +
 * the full Dashboard effect graph. It also lets the rule's
 * assumption (`null` means "fetch rejected within budget") get
 * reused on pages whose Promise.all uses a different fetch list.
 *
 * ## The rule
 *
 *   * `"outage"` — every fetch rejected (server refused all
 *                  sections within the race budget). Dashboard
 *                  paints the "Can't reach AURA" card.
 *   * `"empty"`  — every fetch succeeded AND every section came
 *                  back with zero rows / zero revenue. Dashboard
 *                  paints the "Your label is empty" onboarding
 *                  card above the stats row.
 *   * `null`     — partial success. The Dashboard paints
 *                  `?? 0` / `?? []` fallbacks for the missing
 *                  sections without demanding clean completion.
 *
 * ## Scope
 *
 * This helper evaluates outcomes where the Promise.race settled
 * within budget — i.e. all 10 fetches either resolved or rejected
 * before the timeout. The race-timeout path is handled separately
 * by the Dashboard's `.catch` block, which lumps everything into
 * `"outage"` regardless of which sections actually arrived
 * (because the timeout obscures per-section granularity). If you
 * adapt this helper to a different page's race, the timeout/
 * catch policy is up to that page's caller.
 */

import type {
  AIAction,
  AppNotification,
  Artist,
  ArtistActivity,
  Contract,
  DemoSubmission,
  PromoCampaign,
  Release,
  RevenueSummary,
  Task,
} from "@/types";

/**
 * The resolution state of each of the 10 section fetches after the
 * cold-boot Promise.all settles. `null` means "this fetch was
 * rejected within budget (its own `.catch(() => null)` guard won)";
 * a non-null value means the fetch resolved and we have real data
 * to paint. Note that `[]` (empty array) and `0` (zero revenue) are
 * valid resolved values — they signal "the section arrived but
 * there's nothing in it", which the Dashboard reads as part of the
 * "empty label" check below.
 */
export interface ColdBootInputs {
  demos: DemoSubmission[] | null;
  artists: Artist[] | null;
  contracts: Contract[] | null;
  tasks: Task[] | null;
  releases: Release[] | null;
  campaigns: PromoCampaign[] | null;
  revenue: RevenueSummary | null;
  actions: AIAction[] | null;
  activities: ArtistActivity[] | null;
  notifications: AppNotification[] | null;
}

/**
 * The Dashboard's post-load UX mode:
 *   * `"outage"` — render the dedicated outage card in place of
 *                  the stats+sections tree.
 *   * `"empty"`  — render the "Your label is empty" onboarding
 *                  card above the stats row.
 *   * `null`     — paint the dashboard with whatever arrived.
 */
export type FailureMode = "empty" | "outage" | null;

const TOTAL_SECTIONS = 10;

/**
 * Sum-of-non-null inlined so a future refactor sees every key
 * explicitly — easier to keep aligned with `TOTAL_SECTIONS` by
 * hand than an `Object.values(...).length` collapse. Caveat:
 * manual summation means TS won't catch a dropped key at compile
 * time — if a section goes missing, this quietly returns one
 * fewer than `TOTAL_SECTIONS`; the explicit per-key check is a
 * code-review guard, not a type-level guarantee.
 */
function countNonNull(inputs: ColdBootInputs): number {
  return (
    (inputs.demos !== null ? 1 : 0) +
    (inputs.artists !== null ? 1 : 0) +
    (inputs.contracts !== null ? 1 : 0) +
    (inputs.tasks !== null ? 1 : 0) +
    (inputs.releases !== null ? 1 : 0) +
    (inputs.campaigns !== null ? 1 : 0) +
    (inputs.revenue !== null ? 1 : 0) +
    (inputs.actions !== null ? 1 : 0) +
    (inputs.activities !== null ? 1 : 0) +
    (inputs.notifications !== null ? 1 : 0)
  );
}

/**
 * After all 10 fetches have settled successfully, this returns
 * `true` if at least one section has meaningful content. The
 * Dashboard reads the inverse (`anyNonEmpty === false`) as the
 * trigger for the "Your label is empty" onboarding card.
 *
 * Semantic-shift note: the campaign check counts ANY row,
 * including `completed` / `paused`. The previous
 * `activeCampaigns()` helper filtered to `status === "active" ||
 * status === "planning"` only; that filter was intentionally
 * removed because a label with only completed campaigns reads
 * more honestly as "non-empty" than as "your label is empty".
 */
function sectionUnionNonEmpty(inputs: ColdBootInputs): boolean {
  return (
    (inputs.demos?.length ?? 0) > 0 ||
    (inputs.artists?.length ?? 0) > 0 ||
    (inputs.contracts?.length ?? 0) > 0 ||
    (inputs.tasks?.length ?? 0) > 0 ||
    (inputs.releases?.length ?? 0) > 0 ||
    (inputs.campaigns?.length ?? 0) > 0 ||
    (inputs.revenue?.totalRevenue ?? 0) > 0 ||
    (inputs.actions?.length ?? 0) > 0 ||
    (inputs.activities?.length ?? 0) > 0 ||
    (inputs.notifications?.length ?? 0) > 0
  );
}

export function deriveFailureMode(inputs: ColdBootInputs): FailureMode {
  const successCount = countNonNull(inputs);
  if (successCount === 0) return "outage";
  if (successCount < TOTAL_SECTIONS) return null;
  // All 10 fetches arrived. Distinguish a populated label from a
  // genuinely empty one by the union check above.
  return sectionUnionNonEmpty(inputs) ? null : "empty";
}
