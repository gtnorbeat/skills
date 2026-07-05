import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import type { BetaApplication, BetaApplicationStatus, UserSummary } from "@/types";
import {
  fetchBetaApplications,
  updateBetaApplication,
  createUser,
  logActivity,
} from "@/utils/api";
import { generatePassword } from "@/utils/password";

/**
 * Admin-only review surface for `/api/beta-applications`. Recruits
 * arrive via direct POSTs to `/api/beta-applications` — admin
 * tooling or partner integrations. They land here as
 * `status="pending"`; this panel is the admin's terminal to flip
 * rows between pending / approved / rejected / spam. Mounted as
 * its own `DashboardCard` directly under `TeamAccessPanel` inside
 * the `isAdmin` block in `SettingsPage`.
 *
 * Two tabs: **Pending** (the action queue, default focus) /
 * **Reviewed** (audit log of every application that has been touched
 * grouped by terminal status). The backend's prepared statement
 * already sorts pending-first then by `createdAt DESC`, so this UI
 * trusts the server order — no client-side sort layer needed.
 */
export function BetaApplicationsPanel() {
  const { toast } = useToast();

  const [apps, setApps] = useState<BetaApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");
  // One-row-at-a-time expand, mirroring the per-row editors in
  // TeamAccessPanel so both panels can't grow vertically by applicant
  // count. Toggling the tab closes any open expand.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Local lock so a fast double-click on a status pill can't fire two
  // PATCHes against the same row before the first round-trip lands.
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      setApps(await fetchBetaApplications());
    } catch (err) {
      setError((err as Error).message || "Failed to load beta applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []); // mount-only load — re-fetch is opt-in via the Refresh button

  const handleTabChange = (next: "pending" | "reviewed") => {
    setActiveTab(next);
    // Closing on tab change keeps the affordance obvious: an expanded
    // row in Pending is no longer the action target once you're in
    // Reviewed, and vice versa.
    setExpandedId(null);
  };

  // Idempotent flip — server tolerates a same-status PATCH but we
  // short-circuit UI-side so the toast + refetch don't fire on a
  // no-op click. Every terminal action re-stamps `reviewedBy` /
  // `reviewedAt` on the server (the PATCH handler doesn't special-case
  // re-pended rows), so the audit trail is "last action wins" — the
  // toast copy acknowledges that for the reset-to-pending case.
  const handleStatusUpdate = async (
    app: BetaApplication,
    next: BetaApplicationStatus,
  ) => {
    if (app.status === next || updatingId === app.id) return;
    setUpdatingId(app.id);
    try {
      await updateBetaApplication(app.id, { status: next });

      if (next === "approved") {
        toast.success(`✓ Approved ${app.name}`);
      } else if (next === "rejected") {
        toast.error(`→ Rejected ${app.name}`);
      } else if (next === "spam") {
        toast.error(`→ Marked spam: ${app.name}`);
      } else {
        // Reset-to-pending re-stamps the reviewer on the server; the
        // toast copy is honest about that side effect.
        toast.info(`↶ Reset ${app.name} to pending (reviewer re-stamped)`);
      }

      // Refetch instead of optimistic merge — keeps the list in one
      // source of truth (the server's sort order) and avoids stale
      // reviewedBy/At drift if two admins land actions within the
      // same polling window.
      await loadData();
      // Close the expand after a terminal flip so the row's new
      // bucket (Pending vs Reviewed) is the visible one. Reset-to-
      // pending keeps the expand open because the row is still under
      // the active tab.
      if (next !== "pending") setExpandedId(null);
    } catch (err) {
      toast.error(
        `Failed to update ${app.name}: ${(err as Error).message || "unknown error"}`,
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Approve & Invite shortcut — one click collapses the previously
  // separate `Mark Approved` + `Invite operator` flows into one. PATCH
  // lands first so the row's status always flips regardless of
  // whether the operator-creation succeeds (an approval without an
  // operator is recoverable; an operator without an approval stamp is
  // a UI/audit split-brain). createUser runs second, with its own
  // toast surface — the temp password lands via toast.action with
  // the same Copy CTA TeamAccessPanel uses, so the credential travels
  // through the same channel regardless of which path you clicked.
  //
  // Username derivation: prefer the email's local part (predictable,
  // no spaces, no admin-choice); fall back to a slugified name when
  // email is missing (rare but possible). If BOTH are unrecoverable
  // (anon spam with honeypot-tripped silent 201 — practically never,
  // since the honeypot doesn't reach the DB), the pill is hidden and
  // the admin has to invite manually via Team Access.
  //
  // 409 "username already taken" is surfaced as a warning toast but
  // does NOT roll back the approval — the PATCH already persisted,
  // and the admin's recourse is to invite manually with a renamed
  // user. Same outcome the prior two-tab flow would have produced;
  // just collapsed into one click.
  const deriveUsername = (app: BetaApplication): string => {
    if (app.email && app.email.includes("@")) {
      const local = app.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");
      if (local.length >= 3) return local.slice(0, 50);
    }
    if (app.name) {
      const slug = app.name
        .toLowerCase()
        .replace(/\s+/g, ".")
        .replace(/[^a-z0-9._-]/g, "");
      if (slug.length >= 3) return slug.slice(0, 50);
    }
    return "";
  };

  const handleApproveAndPromote = async (app: BetaApplication) => {
    if (app.status !== "pending" || updatingId === app.id) return;
    const username = deriveUsername(app);
    if (!username) {
      // Should be unreachable when the pill is rendered (the JSX
      // gates on `deriveUsername(app)` truthiness) — defensive only.
      toast.error(
        `Can't derive a username for "${app.name}" — invite manually via Team Access.`,
      );
      return;
    }
    // Generate the password BEFORE the lock so we don't burn the CSPRNG
    // sample if the user double-clicks while another instance is in
    // flight. Same shared helper TeamAccessPanel uses for the modal
    // invite — see src/utils/password.ts for the format guarantee.
    const tempPwd = generatePassword();
    setUpdatingId(app.id);
    try {
      // PATCH first so the approval is guaranteed to persist even if
      // createUser trips a 409 or a network error after.
      await updateBetaApplication(app.id, { status: "approved" });
      toast.success(`✓ Approved ${app.name}`);

      // Operator-creation second. Failure here does NOT roll back the
      // PATCH — the row is approved, the admin just needs to handle the
      // invite edge case out-of-band. Different toast surface so the
      // success signal isn't masked by a `createUser` 409.
      let created = true;
      let newUser: UserSummary | null = null;
      try {
        newUser = await createUser({ username, password: tempPwd, role: "user" });
      } catch (err) {
        created = false;
        const msg = (err as Error).message || "unknown error";
        toast.error(
          `Approved ${app.name} but operator creation failed: ${msg} — invite manually via Team Access.`,
        );
      }

      if (created && newUser) {
        // Same toast.action shape TeamAccessPanel uses, so the
        // Copy-to-clipboard gesture behaves identically across the
        // two invite paths. Snag the password + username into locals
        // before any state mutation just in case a future refactor
        // adds refetches that race these closures (defensive only).
        const pwdForCopy = tempPwd;
        const userForCopy = username;
        toast.action(
          `Invited "${userForCopy}" as operator. Temp password (12 chars): ${pwdForCopy}`,
          {
            label: "Copy",
            onClick: () => {
              navigator.clipboard
                .writeText(pwdForCopy)
                .then(() =>
                  toast.info("Temp password copied to clipboard"),
                )
                .catch(() =>
                  toast.error(
                    "Couldn't copy to clipboard — share the password manually",
                  ),
                );
            },
          },
        );
        // Audit-loop closure — mirror TeamAccessPanel's invite
        // pattern: surface "Promoted N to operator" in the
        // dashboard's ArtistActivityFeed so operator onboarding
        // shows up alongside other artist activity. Fire-and-forget;
        // logActivity swallows transient failures so a one-off
        // network blip never unwinds the just-confirmed invite.
        logActivity({
          artistId: newUser.id,
          artistName: app.name,
          action: `Promoted ${app.name} to operator`,
          type: "note",
        });
      }

      await loadData();
      setExpandedId(null);
    } catch (err) {
      // Only the PATCH path lands here (createUser is in its own try).
      toast.error(
        `Failed to approve ${app.name}: ${(err as Error).message || "unknown error"}`,
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Status pill colour — matches the StatusBadge convention used
  // elsewhere in Settings (cyan=active/pending, emerald=approved,
  // red=rejected, amber=spam). The pulse flag is reserved for the
  // pending action queue so admins spot it on first paint.
  const statusColor = (status: BetaApplicationStatus) => {
    switch (status) {
      case "pending":
        return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
      case "approved":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      case "rejected":
        return "border-red-500/30 bg-red-500/10 text-red-300";
      case "spam":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    }
  };

  const pendingApps = apps.filter((a) => a.status === "pending");
  const reviewedApps = apps.filter((a) => a.status !== "pending");
  const displayed = activeTab === "pending" ? pendingApps : reviewedApps;

  // Reviewed-app secondary grouping: status badge colour already shows
  // the bucket on each row; we keep the chronological order the
  // server returned (createdAt DESC within each status).

  // Relative-time rendering for the "Submitted" line — kept terse so
  // the row header doesn't grow vertically on mobile. Negative diffs
  // (client clock skew against a future-stamped server timestamp)
  // fall through to a calendar date so we never report "today" for a
  // time that hasn't happened yet.
  const formatRelative = (iso: string): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diffMs = Date.now() - then;
    if (diffMs < 0) return new Date(iso).toLocaleDateString();
    const day = 24 * 60 * 60 * 1000;
    if (diffMs < day) return "today";
    if (diffMs < 2 * day) return "yesterday";
    if (diffMs < 14 * day) return `${Math.floor(diffMs / day)}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  // Tab strip — arrow-key navigation follows the WAI-ARIA tabs
  // pattern: Left/Right cycle, Home/End jump to ends. Roving tabindex
  // means only the active tab is in the tab order; arrows move focus
  // between siblings without dropping the user out of the strip.
  const tabs = [
    { key: "pending", label: `Pending (${pendingApps.length})` },
    { key: "reviewed", label: `Reviewed (${reviewedApps.length})` },
  ] as const;
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === activeTab);
    const nextIndex = (() => {
      if (e.key === "ArrowRight") return (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") return (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") return 0;
      if (e.key === "End") return tabs.length - 1;
      return -1;
    })();
    if (nextIndex < 0) return;
    e.preventDefault();
    handleTabChange(tabs[nextIndex].key);
    tabsRef.current[nextIndex]?.focus();
  };

  return (
    <DashboardCard>
      <SectionHeader
        title="Beta Applications"
        subtitle="Review beta cohort applications (POST /api/beta-applications)"
        action={
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        }
      />

      {/* Tab strip — pill-on-bar layout matching the active-tab chip
          convention in the demo inbox filter row. The count sits in
          parentheses so an empty Pending queue reads as "Pending (0)"
          rather than disappearing. Switching tab clears any expanded
          row in handleTabChange. Arrow-key navigation + roving
          tabindex follow the WAI-ARIA tabs pattern (see onTabKeyDown). */}
      <div
        role="tablist"
        aria-label="Application status"
        onKeyDown={onTabKeyDown}
        className="mb-4 flex border-b border-zinc-800/60"
      >
        {tabs.map((tab, i) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => handleTabChange(tab.key)}
              className={`relative -mb-px border-b-2 px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0f] ${
                active
                  ? "border-cyan-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : loading && apps.length === 0 ? (
        // Loading skeleton — first mount with no cached rows.
        <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 px-4 py-8 text-center text-xs text-zinc-600">
          Loading applications…
        </div>
      ) : displayed.length === 0 ? (
        // Empty state — per tab so the call-to-action reads correctly
        // (a fresh cohort sees the recruit-via-API nudge — direct
        // POST /api/beta-applications from admin tools / partners;
        // a busy admin sees "every applicant has been triaged").
        <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 px-4 py-8 text-center text-xs text-zinc-600">
          {activeTab === "pending"
            ? "No pending applications — recruits reach the API via POST /api/beta-applications. Submissions come from admin tooling or partner integrations."
            : "No applications have been reviewed yet."}
        </div>
      ) : (
        // Row list — each row is a header button that toggles its
        // expand section below. The header is a native `<button>` for
        // keyboard nav; click + Enter both fire the same toggle. The
        // ▼/▲ glyph is purely visual.
        <div className="space-y-2">
          {displayed.map((app) => {
            const isExpanded = expandedId === app.id;
            const isUpdating = updatingId === app.id;

            return (
              <div
                key={app.id}
                className="rounded-lg border border-zinc-800/40 bg-zinc-900/30"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : app.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`beta-app-${app.id}`}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-zinc-800/30"
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {app.name || "(anonymous)"}
                    </span>
                    <span className="truncate text-xs text-zinc-500">
                      {app.email}
                    </span>
                    {/* Cohort chip — literal server value, no enum map.
                        "Not specified" is the fallback the server uses
                        when the form's role field is empty. */}
                    <StatusBadge
                      label={app.role}
                      colorClass="border-zinc-700/40 bg-zinc-800/40 text-zinc-400"
                    />
                    <StatusBadge
                      label={app.status}
                      colorClass={statusColor(app.status)}
                      pulse={app.status === "pending"}
                    />
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="text-[10px] text-zinc-600">
                      Submitted {formatRelative(app.createdAt)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-xs text-zinc-500"
                    >
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div
                    id={`beta-app-${app.id}`}
                    className="space-y-4 border-t border-zinc-800/40 px-4 pb-4 pt-3"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                          Label
                        </p>
                        <p className="break-words text-xs text-zinc-300">
                          {app.label || (
                            <span className="text-zinc-600">
                              No label provided
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                          Audit trail
                        </p>
                        <p id={`beta-app-audit-${app.id}`} className="text-[11px] text-zinc-500">
                          {app.reviewedBy && app.reviewedAt ? (
                            <>
                              Reviewed by{" "}
                              <span className="text-zinc-300">
                                {app.reviewedBy}
                              </span>{" "}
                              on{" "}
                              {new Date(app.reviewedAt).toLocaleString()}
                            </>
                          ) : (
                            <span className="text-zinc-600">
                              Not yet reviewed
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                          Applicant notes
                        </p>
                        {/* Read-only — admin doesn't edit applicant
                            content; if a fix is needed, surface via a
                            follow-up email. whitespace-pre-wrap keeps
                            paragraph breaks the applicant typed. */}
                        <div
                          className="rounded-md border border-zinc-800/60 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400"
                        >
                          {app.notes ? (
                            <span className="whitespace-pre-wrap">
                              {app.notes}
                            </span>
                          ) : (
                            <span className="text-zinc-600">
                              No notes provided.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status flip pills — each maps to the
                        `BetaApplicationStatus` enum. The pill for the
                        row's CURRENT status is disabled (no-op PATCH
                        is short-circuited in the handler too). The
                        pill for `next` is disabled while the round
                        trip is in flight, with no spinner to keep the
                        chrome quiet. */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          "pending",
                          "approved",
                          "rejected",
                          "spam",
                        ] as BetaApplicationStatus[]
                      ).map((opt) => {
                        const isCurrent = app.status === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={isUpdating || isCurrent}
                            onClick={() =>
                              void handleStatusUpdate(app, opt)
                            }
                            className={`rounded-md border px-3 py-3.5 text-[11px] font-medium transition-all ${
                              isCurrent
                                ? "cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-600"
                                : "border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                            }`}
                          >
                            {opt === "pending"
                              ? "Reset to Pending"                                    : `Mark ${opt.charAt(0).toUpperCase()}${opt.slice(1)}`}
                                  </button>
                                )})}
                        {/* Approve & Invite shortcut — sits next to
                            Mark Approved, NOT inside the status-pill
                            map because it does extra work (creates an
                            operator row, not just flips a status).
                            PATCH-first ordering in
                            handleApproveAndPromote guarantees the
                            approval persists even if createUser trips
                            a 409 or network error. Hidden — not
                            merely disabled — when the row is non-
                            pending OR when no username can be
                            derived (admin-degraded identity); the
                            explicit absence makes the affordance
                            discoverable from UI alone. */}
                        {app.status === "pending" && deriveUsername(app) && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => void handleApproveAndPromote(app)}
                            title="Flips status to approved AND creates an operator account. The temp password is shown in a toast with a Copy button."
                            aria-label={`Approve and invite ${app.name} as operator`}
                            aria-describedby={`beta-app-audit-${app.id}`}
                            className={`rounded-md border px-3 py-3.5 text-[11px] font-medium transition-all ${
                              isUpdating
                                ? "cursor-not-allowed border-cyan-500/20 bg-cyan-500/5 text-cyan-400/60"
                                : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:border-cyan-500/60 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                            }`}
                          >
                            Approve &amp; Invite
                          </button>
                        )}
                            </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[10px] text-zinc-600">
        Last action is the only audit — the server re-stamps{" "}
        <code className="font-mono text-zinc-500">reviewedBy</code> and{" "}
        <code className="font-mono text-zinc-500">reviewedAt</code> on
        every PATCH regardless of the new status value, so resetting to
        pending re-attributes the row.
      </p>
    </DashboardCard>
  );
}
