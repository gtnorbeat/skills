import { Suspense, useState, useEffect, useCallback } from "react";
import { fetchDemos, fetchArtists, fetchContracts, fetchTasks, fetchReleases, fetchCampaigns, fetchRevenue, fetchAIActions, fetchActivities, fetchNotifications } from "@/utils/api";
import type { DemoSubmission, Artist, Contract, Task, Release, PromoCampaign, AIAction, ArtistActivity, RevenueSummary, MissingInfoItem, AppNotification } from "@/types";
import { StatCard } from "@/components/ui/StatCard";
import { PageLoader } from "@/components/ui/PageLoader";
import { lazyNamed } from "@/utils/lazyNamed";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { useToast } from "@/components/ui/Toast";
import { deriveFailureMode, type ColdBootInputs } from "@/utils/deriveFailureMode";

// Detail panels are lazy-loaded: a user opens at most one at a time, and
// the 5 bundled together would otherwise drag ~30 KB of code into the
// Dashboard chunk that the analyst rarely needs. Each opens on first
// click, then the chunk is cached for the session.
const ReleaseDetail = lazyNamed(() => import("@/components/releases/ReleaseDetail"), "ReleaseDetail");
const TaskDetail = lazyNamed(() => import("@/components/calendar/TaskDetail"), "TaskDetail");
const ContractDetail = lazyNamed(() => import("@/components/contracts/ContractDetail"), "ContractDetail");
const DemoDetail = lazyNamed(() => import("@/components/demo-inbox/DemoDetail"), "DemoDetail");
const ArtistDetail = lazyNamed(() => import("@/components/artists/ArtistDetail"), "ArtistDetail");
import { UpcomingReleases } from "./UpcomingReleases";
import { PendingContracts } from "./PendingContracts";
import { DemosWaiting } from "./DemosWaiting";
import { ActiveCampaigns } from "./ActiveCampaigns";
import { ImportantDeadlines } from "./ImportantDeadlines";
import { ArtistActivityFeed } from "./ArtistActivityFeed";
import { RevenueOverview } from "./RevenueOverview";
import { AIRecommendations } from "./AIRecommendations";
import { TodaysPriorities } from "./TodaysPriorities";
import { OverdueTasks } from "./OverdueTasks";
import { ReleasesNeedingAttention } from "./ReleasesNeedingAttention";
import { MissingArtistInfo } from "./MissingArtistInfo";

function demosReceivedThisWeek(demos: DemoSubmission[]): number {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return demos.filter((d) => new Date(d.receivedDate) >= weekAgo).length;
}

function demosAwaitingReview(demos: DemoSubmission[]): DemoSubmission[] {
  return demos.filter((d) => d.status === "new" || d.status === "listening" || d.status === "interested");
}

function deriveMissingInfo(artists: Artist[]): Artist[] {
  return artists.map((a) => {
    const missing: MissingInfoItem[] = [];
    if (!a.bio) missing.push({ field: "bio", description: "Artist biography not yet written" });
    if (!a.imageUrl) missing.push({ field: "photo", description: "Artist photo not uploaded" });
    const hasInstagram = a.socialLinks?.some((s) => s.platform.toLowerCase().includes("instagram"));
    if (!hasInstagram) missing.push({ field: "social", description: "No Instagram account linked" });
    return { ...a, missingInfo: missing };
  }).filter((a) => a.missingInfo && a.missingInfo.length > 0);
}

export function Dashboard() {
  // Toast for the outage path — assertive so screen-reader users get an
  // actionable signal on the spot rather than missing the polite-chime
  // eyebrow chip if they were mid-task. The toast lives in the bottom-
  // right anchor of ToastProvider (already mounted at App level), so
  // calling toast.error here just queues a stack entry — it doesn't
  // mount/unmount anything in the Dashboard tree.
  const { toast } = useToast();

  const [liveDemos, setLiveDemos] = useState<DemoSubmission[] | null>(null);
  const [liveArtists, setLiveArtists] = useState<Artist[] | null>(null);
  const [liveContracts, setLiveContracts] = useState<Contract[] | null>(null);
  const [liveTasks, setLiveTasks] = useState<Task[] | null>(null);
  const [liveReleases, setLiveReleases] = useState<Release[] | null>(null);
  const [liveCampaigns, setLiveCampaigns] = useState<PromoCampaign[] | null>(null);
  const [liveRevenue, setLiveRevenue] = useState<RevenueSummary | null>(null);
  const [liveAIActions, setLiveAIActions] = useState<AIAction[] | null>(null);
  const [liveActivities, setLiveActivities] = useState<ArtistActivity[] | null>(null);
  const [liveNotifications, setLiveNotifications] = useState<AppNotification[] | null>(null);

  // Initial-load gate — separate from the per-section "loaded" flags so
  // the dashboard renders a skeleton only on cold boot. After the first
  // batch resolves the page paints with whatever data arrived (per
  // failing section, the local state stays null and the section falls
  // back to live-or-zero semantics below — the previous behaviour with
  // a hard-coded mock fallback). The 60 s notifications poll proceeds
  // in a separate effect so a notification backend outage does not
  // block the hero from painting.
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  // Tri-state load outcome — drives the three orthogonal branches of
  // "what does the dashboard look like after the cold-boot race
  // settles":
  //   * "outage"  → every fetch rejected OR the race timed out.
  //     Surfaces the dedicated "Can't reach AURA" card in place of
  //     the stats+sections tree (otherwise the `?? 0` fallbacks
  //     would read every section as empty and lie to the user
  //     about why their data is missing).
  //   * "empty"   → every fetch succeeded and every section came
  //     back with no rows / zero revenue. The "Your label is
  //     empty" message renders above the stats row.
  //   * null      → partial success (some fetches returned data,
  //     some did not). Paint the stats + sections with zeros for
  //     missing sections; prioritise showing the data we did get
  //     over demanding clean completion.
  const [failureMode, setFailureMode] = useState<"empty" | "outage" | null>(null);

  useEffect(() => {
    let mounted = true;

    // 12 s ceiling on the cold-boot batch. The per-fetch
    // `.catch(() => null)` already handles individual rejections
    // but does NOT cap a hung fetch — without this race a single
    // server-side stall (e.g. database lock contention mid-query, or
    // a network blip on the very first request after server boot)
    // strands the skeleton forever. The race rejects at the budget,
    // the outer `.catch` flips `initialLoadDone` so the page paints
    // whatever data did arrive, and per-section state that didn't
    // resolve stays at its initial `null` (rendering as zero counts
    // via the `?? []` / `?? 0` fallbacks below — the empty-state
    // card stays hidden because it's gated on *known-empty* arrays,
    // not unknown ones). 12 s is a bit more than double the 5.5 s
    // toast budget used elsewhere; database cold-start typically finishes
    // in tens of milliseconds, so the cap only triggers on a genuine
    // hang rather than slow-but-healthy queries.
    const DASHBOARD_LOAD_TIMEOUT_MS = 12_000;
    // The timeout ID is captured to a closure-scoped variable so the
    // cleanup callback below can clearTimeout it on unmount — without
    // this, React 18 StrictMode's double-invoke queues two timers that
    // both fire 12 s later and both call reject on a no-longer-mounted
    // component (state writes are guarded by `mounted`, but the
    // scheduled timer itself was a leak under fast remounts).
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    Promise.race([
      Promise.all([
        fetchDemos().catch(() => null as DemoSubmission[] | null),
        fetchArtists().catch(() => null as Artist[] | null),
        fetchContracts().catch(() => null as Contract[] | null),
        fetchTasks().catch(() => null as Task[] | null),
        fetchReleases().catch(() => null as Release[] | null),
        fetchCampaigns().catch(() => null as PromoCampaign[] | null),
        fetchRevenue().catch(() => null as RevenueSummary | null),
        fetchAIActions().catch(() => null as AIAction[] | null),
        fetchActivities().catch(() => null as ArtistActivity[] | null),
        fetchNotifications().catch(() => null as AppNotification[] | null),
      ]),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Dashboard load timed out \u2014 some sections may not have arrived")),
          DASHBOARD_LOAD_TIMEOUT_MS,
        );
      }),
    ])
      .then(([demos, artists, contracts, tasks, releases, campaigns, revenue, actions, activities, notifications]) => {
        if (!mounted) return;
        if (demos) setLiveDemos(demos);
        if (artists) setLiveArtists(artists);
        if (contracts) setLiveContracts(contracts);
        if (tasks) setLiveTasks(tasks);
        if (releases) setLiveReleases(releases);
        if (campaigns) setLiveCampaigns(campaigns);
        if (revenue) setLiveRevenue(revenue);
        if (actions) setLiveAIActions(actions);
        if (activities) setLiveActivities(activities);
        if (notifications) setLiveNotifications(notifications);
        // Hand off the post-load UX classification to the pure helper
        // in `src/utils/deriveFailureMode.ts` so the rule stays out of
        // the effect graph. The `.catch` block below (race-timeout
        // path) still hard-codes "outage" because the timeout
        // obscures the per-section breakdown — the helper covers the
        // "everything settled within budget" branch only.
        const inputs: ColdBootInputs = {
          demos, artists, contracts, tasks, releases,
          campaigns, revenue, actions, activities, notifications,
        };
        // Local `failureMode` shadows the React state name from
        // `useState` above. Safe because this arrow body only
        // *sets* the state (never reads it) — reading the local
        // directly is the right move so the toast fires off a
        // settled value rather than waiting for the next commit.
        const failureMode = deriveFailureMode(inputs);
        setFailureMode(failureMode);
        if (failureMode === "outage") {
          // The lifted `if (!mounted) return;` at the top of `.then`
          // already early-returns on a StrictMode probe mount that
          // settles late — the toast below fires only from the live
          // mount's race, so a single toast appears per cold boot.
          toast.error("Some sections didn't load — try refreshing");
        }
        setInitialLoadDone(true);
      })
      .catch(() => {
        if (!mounted) return;
        // Race rejected — the most likely cause is a hung fetch /
        // server stall. We don't know which sections actually
        // failed vs. which would have completed, so we lump it
        // into "outage". The dedicated "Can't reach AURA" card
        // renders in place of the stats+sections+empty-state
        // tree, so the user gets an honest signal instead of
        // "Your label is empty" advice based on zeros from the
        // `?? 0` / `?? []` fallbacks. The toast (matching the
        // successCount === 0 branch above) carries the actionable
        // recovery hint; the eyebrow chip + outage card paint the
        // persistent page chrome. Three independent signals
        // (assertive toast / polite eyebrow / in-page card) so any
        // one of those paths failing to reach the user isn't fatal
        // — sighted glance reads the card, SR hears the assertive
        // announcement, peripheral vision catches the chip pulse.
        // One settle of the race fires the toast at most once
        // because the `mounted` guard above kills any late
        // callbacks from a StrictMode probe mount.
        setInitialLoadDone(true);
        setFailureMode("outage");
        toast.error("Some sections didn't load — try refreshing");
      });

    return () => {
      mounted = false;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  // Poll /api/notifications every 60 s so the eyebrow status chip
  // transitions between "all clear" / "X alerts" / "X critical"
  // without a page reload. Silent on failure to preserve prior state.
  useEffect(() => {
    if (!initialLoadDone) return;
    let cancelled = false;
    const poll = () => {
      fetchNotifications()
        .then((data) => { if (!cancelled) setLiveNotifications(data); })
        .catch(() => { /* keep prior state */ });
    };
    const interval = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [initialLoadDone]);

  // Build artist image lookup
  const artistImages: Record<string, string> = {};
  if (liveArtists) {
    for (const a of liveArtists) {
      if (a.imageUrl) artistImages[a.id] = a.imageUrl;
    }
  }

  // Selected items for detail panels
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  // Lookup full entities from live data only — previously the dashboard
  // fell back to mockDashboardSummary which is now removed. Detail
  // panels staying closed for any not-yet-loaded id is the correct UX
  // (it's not a crash; it just means the user can't drill into a row
  // whose data we never received).
  const selectedRelease = selectedReleaseId ? liveReleases?.find((r) => r.id === selectedReleaseId) ?? null : null;
  const selectedTask = selectedTaskId ? liveTasks?.find((t) => t.id === selectedTaskId) ?? null : null;
  const selectedContract = selectedContractId ? liveContracts?.find((c) => c.id === selectedContractId) ?? null : null;
  const selectedDemo = selectedDemoId ? liveDemos?.find((d) => d.id === selectedDemoId) ?? null : null;
  const selectedArtist = selectedArtistId ? liveArtists?.find((a) => a.id === selectedArtistId) ?? null : null;

  const handleReleaseUpdated = useCallback((updated: Release) => {
    if (liveReleases) {
      setLiveReleases(liveReleases.map((r) => r.id === updated.id ? updated : r));
    }
  }, [liveReleases]);

  const handleReleaseDeleted = useCallback((id: string) => {
    setSelectedReleaseId(null);
    if (liveReleases) {
      setLiveReleases(liveReleases.filter((r) => r.id !== id));
    }
  }, [liveReleases]);

  const handleTaskStatusChange = useCallback((id: string, status: Task["status"]) => {
    if (liveTasks) {
      setLiveTasks(liveTasks.map((t) => t.id === id ? { ...t, status } : t));
    }
  }, [liveTasks]);

  const handleTaskUpdated = useCallback((updated: Task) => {
    if (liveTasks) {
      setLiveTasks(liveTasks.map((t) => t.id === updated.id ? updated : t));
    }
  }, [liveTasks]);

  const handleContractUpdated = useCallback((updated: Contract) => {
    if (liveContracts) {
      setLiveContracts(liveContracts.map((c) => c.id === updated.id ? updated : c));
    }
  }, [liveContracts]);

  const handleContractDeleted = useCallback((id: string) => {
    setSelectedContractId(null);
    if (liveContracts) {
      setLiveContracts(liveContracts.filter((c) => c.id !== id));
    }
  }, [liveContracts]);

  const handleDemoUpdated = useCallback((updated: DemoSubmission) => {
    if (liveDemos) {
      setLiveDemos(liveDemos.map((d) => d.id === updated.id ? updated : d));
    }
  }, [liveDemos]);

  const handleDemoDeleted = useCallback((id: string) => {
    setSelectedDemoId(null);
    if (liveDemos) {
      setLiveDemos(liveDemos.filter((d) => d.id !== id));
    }
  }, [liveDemos]);

  const handleArtistUpdated = useCallback((updated: Artist) => {
    if (liveArtists) {
      setLiveArtists(liveArtists.map((a) => a.id === updated.id ? updated : a));
    }
  }, [liveArtists]);

  const handleArtistDeleted = useCallback((id: string) => {
    setSelectedArtistId(null);
    if (liveArtists) {
      setLiveArtists(liveArtists.filter((a) => a.id !== id));
    }
  }, [liveArtists]);

  // Derive all stats from live data — zeros on initial load. The cards
  // render fine on a 0; the per-section dashboards render empty lists
  // when arrays haven't arrived, replaced with empty-state copy below.
  const totalArtists = liveArtists?.length ?? 0;
  const totalReleases = liveReleases?.length ?? 0;
  const activeContracts = liveContracts?.filter((c) => c.status === "signed").length ?? 0;
  const demosThisWeekCount = liveDemos ? demosReceivedThisWeek(liveDemos) : 0;
  const awaitingReview = liveDemos ? demosAwaitingReview(liveDemos) : [];
  const pendingContracts = liveContracts
    ? liveContracts.filter((c) => c.status === "draft" || c.status === "sent")
    : [];

  const upcomingReleases = liveReleases
    ? liveReleases.filter((r) => r.status !== "released" && r.status !== "archived")
    : [];
  const launchReadinessPct = liveReleases && liveReleases.length > 0
    ? Math.round(liveReleases.reduce((sum, r) => sum + r.readinessPercentage, 0) / liveReleases.length)
    : 0;
  const releasesNeedingAttention = liveReleases
    ? liveReleases.filter((r) => r.needsAttention)
    : [];

  const todaysPriorities = liveTasks
    ? liveTasks.filter((t) => t.priority === "high" && t.status === "todo")
    : [];
  const importantDeadlines = liveTasks
    ? liveTasks.filter((t) => t.priority === "high" || t.priority === "critical")
    : [];
  const overdueTasks = liveTasks
    ? liveTasks.filter((t) => t.overdue)
    : [];

  // Eyebrow status chip — derived from live notifications. Colors
  // escalate: cyan (all clear) → amber (alerts) → red (critical).
  const notifs = liveNotifications ?? [];
  const criticalCount = notifs.filter(
    (n) => n.type === "task_overdue" || n.type === "contract_expiring"
  ).length;
  const totalCount = notifs.length;
  // Eyebrow chip escalates from cyan (calm) → amber (alerts) →
  // red (critical), with the outage state always ahead of the
  // notifications-driven branches so a server-down condition
  // reads as "Service unreachable" rather than a misleading
  // "All systems clear" (which would otherwise fire when
  // `liveNotifications` is `null` and `failureMode` is `null`).
  const eyebrowColor =
    failureMode === "outage" ? "text-red-400" :
    criticalCount > 0 ? "text-red-400" :
    totalCount > 0 ? "text-amber-400" :
    "text-cyan-400/70";
  const eyebrowDotClass =
    failureMode === "outage" ? "bg-red-400" :
    criticalCount > 0 ? "bg-red-400" :
    totalCount > 0 ? "bg-amber-400" :
    "bg-cyan-400";
  const eyebrowLabel =
    failureMode === "outage" ? "Service unreachable" :
    criticalCount > 0 ? `${criticalCount} critical` :
    totalCount > 0 ? `${totalCount} alert${totalCount === 1 ? "" : "s"}` :
    "All systems clear";

  // The empty-state card below only fires once we *know* the server
  // returned [] for every section. We're already guarding that with
  // the surrounding `{initialLoadDone && …}` fragment wrapper, so
  // no separate `showEmptyStateHints` flag is needed here.

  return (
    <div className="space-y-8">
      {/* Hero band — brand anchor. Transparent plate (no aura-glass,
          no rounded card, no overflow clip) so the eyebrow + h1 +
          corner orbs float over the body bg as one continuous canvas.
          AuraBrand is now an inline SVG with transparent backdrop, so
          the tree has no PNG-import or near-black raster among the
          hero pixels. */}
      <section className="relative flex flex-col items-center px-6 py-6 text-center sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true" />
        <div className="flex flex-col items-center">
          <div
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${eyebrowColor}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${eyebrowDotClass} ${
                totalCount > 0 || failureMode === "outage" ? "animate-pulse" : ""
              }`}
              aria-hidden="true"
            />
            <span>{eyebrowLabel}</span>
          </div>
          <h1
            id="aura-hero-title"                            className="mt-2 max-w-3xl text-2xl lg:text-4xl text-balance text-zinc-900"
            style={{ fontFamily: '"Ethnocentric Light", "Ethnocentric", sans-serif', letterSpacing: '0.02em' }}
          >
            A&amp;R Utility &amp; Resources AI Assistant
          </h1>
        </div>
      </section>

      {/* Cold-boot skeleton — the hero band above paints immediately
          (it's brand/page chrome with no data dependency), but every
          section below derives from the 10-way Promise.all. Without a
          skeleton the stat row fell back to "0 artists / 0 releases /
          0 contracts / 0 demos / 0% readiness" before the batch
          resolved — a visually loud flash that also broke the empty-
          state guard (the counts were 0 / 0 / 0 / 0 *during* loading,
          not because the label was empty). The min-h-[50vh] wrapper
          gives the skeleton a real visual presence — PageLoader uses
          h-full internally and collapses to intrinsic content height
          when its parent doesn't define a height, like our outer
          <div className="space-y-8"> — so without the wrapper the
          spinner would render at its raw 80 px footprint and the
          page would visibly jump 50 vh when the batch resolved. */}
      {!initialLoadDone && (
        // min-h-[50vh] gives the skeleton a real visual presence
        // (see the outer comment above for why PageLoader's h-full
        // contract needs an explicit parent height). The static
        // aria-label gives screen-reader users an accessible name
        // they can navigate to via virtual cursor / browse mode
        // WITHOUT firing a polite announcement on mount — the hero
        // band's eyebrow chip above already owns the
        // role="status" aria-live="polite" node for the *result*
        // (all-clear / alerts / outage), so stacking another live
        // region here would create a duplicate SR announcement on
        // cold boot. ARIA distinction: `aria-label` provides an
        // accessible NAME (announced on user navigation);
        // `aria-live` regions announce on content change and (in
        // most modern browsers) on initial mount — two separate
        // mechanisms that must not be confused here. PageLoader's
        // `message=""` lets the inner spinner skip its `<p>` tag
        // entirely (no gap-3 void) so the wrapper aria-label remains
        // the sole accessible name for the region.
        <div
          className="min-h-[50vh]"
          aria-label="Loading dashboard"
        >
          <PageLoader message="" />
        </div>
      )}

      {initialLoadDone && (
        <>
      {/* Outcome cards — an outage (server unreachable) wins over
          the empty-state card so a hung server doesn't lie to the
          user with "Your label is empty" copy based on the `?? 0`
          fallbacks reading every section as empty. The outage
          branch REPLACES the stats + sections + detail-panel
          tree entirely (not stacked on top of it) — the user
          gets one honest card, not a row of false zeros
          underneath a misleading empty-state message. The
          post-outage subtree paints when `failureMode !==
          "outage"`; on `failureMode === null` (partial success)
          we fall through to the stats + sections normally. The
          parent `{initialLoadDone && …}` fragment already gates
          on load completion. */}
      {failureMode === "outage" && (
        <DashboardCard>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="text-3xl text-red-400/70 aura-float">⚠</span>
            <p className="text-sm font-semibold text-zinc-900">Can&apos;t reach AURA</p>
            <p className="text-xs text-zinc-500 max-w-md">
              We couldn&apos;t load the dashboard from the server. Check your connection and try refreshing the page — if the problem persists, the API server may be down.
            </p>
          </div>
        </DashboardCard>
      )}

      {failureMode !== "outage" && (
        <>
        {/* Empty-state card — explicitly gated on `failureMode ===
            "empty"`, which the Promise.race `.then` handler above
            sets only when ALL 10 fetches succeeded AND every
            section came back empty. Even though the `?? 0` /
            `?? []` fallbacks below make `totalArtists === 0 &&
            …` evaluate true on partial success, `failureMode`
            correctly holds off the card in that case so we
            don&apos;t show "Your label is empty" advice when the
            data simply didn&apos;t arrive. */}
        {failureMode === "empty" && (
          <DashboardCard>
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="text-3xl text-zinc-700 aura-float">◈</span>
              <p className="text-sm font-semibold text-zinc-900">Your label is empty</p>
              <p className="text-xs text-zinc-400">
                Start with an artist on the{" "}
                <a href="/artists" className="text-cyan-400 hover:text-cyan-300">Artists</a>{" "}
                page, then add releases / contracts / demos from each section.
              </p>
            </div>
          </DashboardCard>
        )}

      {/* Top row: key stats — staggered entry */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="aura-enter-fade aura-stagger-1">
          <StatCard
            label="Total Artists"
            value={totalArtists}
            icon={<span className="text-sm">◈</span>}
          />
        </div>
        <div className="aura-enter-fade aura-stagger-2">
          <StatCard
            label="Total Releases"
            value={totalReleases}
            subtext={`${upcomingReleases.length} upcoming`}
            icon={<span className="text-sm">▣</span>}
          />
        </div>
        <div className="aura-enter-fade aura-stagger-3">
          <StatCard
            label="Active Contracts"
            value={activeContracts}
            subtext={`${pendingContracts.length} pending`}
            icon={<span className="text-sm">◇</span>}
          />
        </div>
        <div className="aura-enter-fade aura-stagger-4">
          <StatCard
            label="Demos This Week"
            value={demosThisWeekCount}
            subtext={`${awaitingReview.length} awaiting review`}
            icon={<span className="text-sm">▷</span>}
            accent
          />
        </div>
        <div className="aura-enter-fade aura-stagger-5 col-span-2 lg:col-span-1">
          <StatCard
            label="Launch Readiness"
            value={`${launchReadinessPct}%`}
            subtext="Across all releases"
            icon={<span className="text-sm">◉</span>}
          />
        </div>
      </div>

      {/* Row 1 — Triage / Action Center */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <TodaysPriorities tasks={todaysPriorities} onSelect={setSelectedTaskId} />
        <OverdueTasks tasks={overdueTasks} onSelect={setSelectedTaskId} />
        <ImportantDeadlines deadlines={importantDeadlines} onSelect={setSelectedTaskId} />
        <ReleasesNeedingAttention releases={releasesNeedingAttention} artistImages={artistImages} onSelect={setSelectedReleaseId} />
        <MissingArtistInfo
          artists={liveArtists ? deriveMissingInfo(liveArtists) : []}
          artistImages={artistImages}
          onSelect={setSelectedArtistId}
        />
        <AIRecommendations recommendations={liveAIActions ?? []} />
      </div>

      {/* Row 2 — Business & Inbox */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ActiveCampaigns campaigns={liveCampaigns ?? []} />
        <RevenueOverview revenue={liveRevenue ?? { totalRevenue: 0, monthlyRevenue: 0, pendingPayouts: 0, revenueByArtist: [], revenueByRelease: [], currency: "EUR" }} />
        <PendingContracts contracts={pendingContracts} artistImages={artistImages} onSelect={setSelectedContractId} />
        <DemosWaiting demos={awaitingReview} onSelect={setSelectedDemoId} />
      </div>

      {/* Row 3 — Pipeline & Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingReleases releases={upcomingReleases} onSelect={setSelectedReleaseId} />
        <ArtistActivityFeed activity={liveActivities ?? []} artistImages={artistImages} />
      </div>

      {/* Detail panels */}
      <Suspense fallback={
        // Detail panel chunk load — the fallback replaces
        // whichever of the five lazy panels the user just
        // selected (release / task / contract / demo / artist).
        // There's no parent landmark above this Suspense slot
        // — the conditional {selectedX && ...} renders one
        // panel at a time — so `role="region"` is the more
        // important of the three wrappers: it promotes the
        // loading region to an explicit SR landmark
        // discoverable by landmark-navigation commands (D in
        // NVDA, R in JAWS), not just by virtual-cursor sweep.
        // Inner PageLoader passes an empty `message` so the
        // wrapper aria-label is the sole accessible name —
        // the visible spinner stands in for the absent `<p>`
        // so sighted users still see something rotating
        // during the cold open of a fresh detail chunk,
        // matching the Dashboard main-skeleton treatment.
        <div
          role="region"
          aria-label="Loading detail panel"
        >
          <PageLoader message="" />
        </div>
      }>
        {selectedRelease && (
          <ReleaseDetail
            release={selectedRelease}
            onClose={() => setSelectedReleaseId(null)}
            onUpdated={handleReleaseUpdated}
            onDeleted={handleReleaseDeleted}
          />
        )}
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onStatusChange={handleTaskStatusChange}
            onUpdate={handleTaskUpdated}
          />
        )}
        {selectedContract && (
          <ContractDetail
            contract={selectedContract}
            onClose={() => setSelectedContractId(null)}
            onUpdated={handleContractUpdated}
            onDeleted={handleContractDeleted}
          />
        )}
        {selectedDemo && (
          <DemoDetail
            demo={selectedDemo}
            onClose={() => setSelectedDemoId(null)}
            onUpdate={handleDemoUpdated}
            onDelete={handleDemoDeleted}
          />
        )}
        {selectedArtist && (
          <ArtistDetail
            artist={selectedArtist}
            onClose={() => setSelectedArtistId(null)}
            onUpdated={handleArtistUpdated}
            onDeleted={handleArtistDeleted}
          />
        )}
      </Suspense>
        </>
      )}
        </>
      )}
    </div>
  );
}

