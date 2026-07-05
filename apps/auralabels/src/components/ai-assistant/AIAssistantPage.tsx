import { useState, useEffect, useRef } from "react";
import type { Artist, Release, Contract, DemoSubmission } from "@/types";
import type { AuraVariant } from "@/components/ui/AuraAMark";
import { fetchArtists, fetchReleases, fetchContracts, fetchDemos, generateAI } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { PRESET_ACTIONS, TONES } from "@/utils/aiMock";
import type { Tone } from "@/utils/aiMock";

/**
 * The subset of AuraVariant that the chrome uses to colour itself to
 * reflect live AI activity. "brand" is intentionally excluded here:
 * the chrome only adopts `idle | thinking | result` from this side —
 * `brand` stays the AuraAMark default for everywhere else (logo lockup,
 * login, hero). Keeping this as `Exclude<>` rather than a parallel
 * string-literal type ensures the union can't drift from AuraVariant.
 */
export type AiStatus = Exclude<AuraVariant, "brand">;

// Actions that need a demo selected (instead of a release)
const DEMO_ACTIONS = new Set(["generate_demo_feedback", "generate_rejection_email", "generate_interest_email", "ar_demo_review"]);
// Actions that need a contract selected (instead of a release)
const CONTRACT_ACTIONS = new Set(["draft_contract_notes"]);
// A&R actions — use a hardcoded "direct" tone; tone selector is hidden
const AR_ACTIONS = new Set(["ar_demo_review", "ar_artist_analysis"]);

/** How long the chrome stays on the magenta "result" tint after the
 *  output finishes before fading back to idle green. Long enough that a
 *  glance catches the "AI just produced something" cue, short enough
 *  that it doesn't pin the chrome in result-state between generations. */
const RESULT_TINT_TTL_MS = 6000;

export function AIAssistantPage({
  isRail = false,
  onAiStatusChange,
}: {
  isRail?: boolean;
  /** Fired whenever the live AI activity state transitions. AppLayout
   *  owns this and forwards the value to Header + Sidebar AuraAMarks. */
  onAiStatusChange?: (status: AiStatus) => void;
} = {}) {
  const { isOnline } = useNetworkStatus();
  const [selectedAction, setSelectedAction] = useState<string>("draft_release_description");
  const [artistId, setArtistId] = useState<string>("");
  const [releaseId, setReleaseId] = useState<string>("");
  const [demoId, setDemoId] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [tone, setTone] = useState<Tone>("professional");
  const [context, setContext] = useState("");
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<string | null>(null);

  // Live data state
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [demos, setDemos] = useState<DemoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Controls panel state
  const [controlsOpen, setControlsOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // Auto-open controls when an action is selected
  function handleSelectAction(id: string) {
    setSelectedAction(id);
    setOutput("");
    setControlsOpen(true);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [fetchedArtists, fetchedReleases, fetchedContracts, fetchedDemos] = await Promise.all([
          fetchArtists(),
          fetchReleases(),
          fetchContracts(),
          fetchDemos(),
        ]);
        if (cancelled) return;
        setArtists(fetchedArtists);
        setReleases(fetchedReleases);
        setContracts(fetchedContracts);
        setDemos(fetchedDemos);
        // Pre-select first artist
        if (fetchedArtists.length > 0) {
          setArtistId(fetchedArtists[0].id);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Report AI activity state to the chrome (AppLayout → Header + Sidebar
  // AuraAMark) so the small contextual mark tints green when idle,
  // amber while a generation is in flight, and magenta on a fresh
  // result that auto-fades back to idle after RESULT_TINT_TTL_MS so the
  // chrome doesn't get pinned on magenta between generations.
  //
  // The cleanup cancels any pending fade-back timer when this effect
  // re-runs (e.g., user clicks Generate again, switching state to
  // "thinking" before the 6s is up — without that the magenta flash
  // would briefly fire after the new "thinking" amber tint landed).
  useEffect(() => {
    if (!onAiStatusChange) return;
    let status: AiStatus = "idle";
    if (generating) {
      status = "thinking";
    } else if (output && !output.startsWith("Error") && !output.startsWith("⚠")) {
      status = "result";
    }
    onAiStatusChange(status);
    if (status === "result") {
      const id = window.setTimeout(() => onAiStatusChange("idle"), RESULT_TINT_TTL_MS);
      return () => window.clearTimeout(id);
    }
  }, [generating, output, onAiStatusChange]);

  // Determine if this action uses demo or contract context
  const needsDemo = DEMO_ACTIONS.has(selectedAction);
  const needsContract = CONTRACT_ACTIONS.has(selectedAction);
  const isArAction = AR_ACTIONS.has(selectedAction);
  const needsRelease = !needsDemo && !needsContract;

  // Filter releases by selected artist
  const artistReleases = releases.filter(
    (r) => r.artistId === artistId || artistId === ""
  );

  // Filter contracts by selected artist
  const artistContracts = contracts.filter(
    (c) => c.artistId === artistId || artistId === ""
  );

  const currentArtist = artists.find((a) => a.id === artistId) ?? null;
  const currentRelease = releases.find((r) => r.id === releaseId) ?? null;
  const currentDemo = demos.find((d) => d.id === demoId) ?? null;
  const currentContract = contracts.find((c) => c.id === contractId) ?? null;
  const currentAction = PRESET_ACTIONS.find((a) => a.id === selectedAction);

  async function handleGenerate() {
    setGenerating(true);
    setOutput("");
    setProvider(null);

    try {
      const result = await generateAI({
        actionType: selectedAction,
        artist: currentArtist,
        release: currentRelease,
        demo: currentDemo,
        contract: currentContract,
        tone,
        context: context || undefined,
      });
      setOutput(result.content);
      setProvider(result.provider);
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : "AI generation failed"}`);
    } finally {
      setGenerating(false);
    }
  }

  // Loading state
  if (loading) {
    return <PageLoader message="" />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState
        message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const actionButtons = (
    <div className="grid grid-cols-1 gap-1.5">
      {PRESET_ACTIONS.map((action) => {
        const isActive = selectedAction === action.id;
        const usesDemo = DEMO_ACTIONS.has(action.id);
        const usesContract = CONTRACT_ACTIONS.has(action.id);
        return (
          <button
            key={action.id}
            onClick={() => handleSelectAction(action.id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all duration-200 ${
              isActive
                ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                : usesDemo
                  ? "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                  : usesContract
                    ? "text-violet-500 hover:bg-violet-500/10 hover:text-violet-400"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
            }`}
          >
            <span className="text-sm">{action.icon}</span>
            <span>{action.label}</span>
            {usesDemo && <span className="ml-auto text-[10px] text-amber-600">demo</span>}
            {usesContract && <span className="ml-auto text-[10px] text-violet-600">contract</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    // When `isRail=true` (mounted in the docked right-side panel inside
    // AppLayout) we collapse to a flex-column with 2 distinct blocks
    // separated by a visual divider — no nested scrolls. The full-page
    // /ai route leaves the original 3-column grid intact.
    <div className={isRail ? "flex h-full flex-col" : "space-y-6"}>
      {!isRail && (
        <SectionHeader
          title="AI Label Assistant"
          subtitle={
            artists.length > 0
              ? `${artists.length} artist${artists.length > 1 ? "s" : ""} · ${releases.length} release${releases.length > 1 ? "s" : ""} · ${demos.length} demo${demos.length > 1 ? "s" : ""} · ${contracts.length} contract${contracts.length > 1 ? "s" : ""} live`
              : "Generate copy, strategies, and insights for your label"
          }
        />
      )}

      {/* ── Rail mode: action grid + collapsible controls ──────── */}
      {isRail ? (
        <div ref={railRef} className="flex h-full flex-col">
          {/* GenAI header — always-visible section title above the
              scrollable action grid. Stays pinned when the actions below
              scroll. */}
          <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 rounded-full bg-cyan-500/60" />
              <p className="text-xs font-semibold tracking-[0.12em] text-cyan-400">
                GenAI
              </p>
            </div>
          </div>

          {/* Action grid — fills remaining space, scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-medium text-zinc-600">
                Select an action
              </p>
              <div className="grid grid-cols-1 gap-1.5">
              {PRESET_ACTIONS.map((action) => {
                const isActive = selectedAction === action.id;
                const usesDemo = DEMO_ACTIONS.has(action.id);
                const usesContract = CONTRACT_ACTIONS.has(action.id);
                const usesCategory = usesDemo || usesContract;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleSelectAction(action.id)}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                        : usesDemo
                          ? "text-zinc-500 hover:bg-amber-500/10 hover:text-amber-400"
                          : usesContract
                            ? "text-zinc-500 hover:bg-violet-500/10 hover:text-violet-400"
                            : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-400"
                        : "bg-zinc-800/60 text-zinc-500 group-hover:bg-zinc-800"
                    }`}>
                      {action.icon}
                    </span>
                    <span className="flex-1 leading-tight">{action.label}</span>
                    {usesCategory && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                        usesDemo
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-violet-500/10 text-violet-500"
                      }`}>
                        {usesDemo ? "demo" : "contract"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            </div>
          </div>

          {/* Toggle button for controls panel */}
          <button
            onClick={() => setControlsOpen((v) => !v)}
            className={`flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 mt-2 ${
              controlsOpen
                ? "bg-cyan-500/10 text-cyan-400"
                : "bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-sm">{controlsOpen ? "▼" : "▶"}</span>
              {controlsOpen
                ? (currentAction?.label ?? "Select action")
                : "Controls"}
            </span>
            {controlsOpen && (
              <span className="text-[10px] text-zinc-600">
                {artistId ? artists.find((a) => a.id === artistId)?.name : "No artist"}
              </span>
            )}
          </button>

          {/* Collapsible controls + output panel */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              controlsOpen ? "max-h-[600px] opacity-100 mt-2" : "max-h-0 opacity-0"
            }`}
          >
            <div className="space-y-3 overflow-y-auto pr-1">
              {/* Controls */}
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {currentAction?.label ?? "Select an action"}
                  </p>
                  {needsDemo && <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-400">demo</span>}
                  {needsContract && <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[9px] font-medium text-violet-400">contract</span>}
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-zinc-500">Artist</label>
                    <select
                      value={artistId}
                      onChange={(e) => {
                        setArtistId(e.target.value);
                        setReleaseId(""); setContractId(""); setDemoId("");
                      }}
                      className="w-full rounded-md border border-zinc-800/60 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    >
                      <option value="">Select artist...</option>
                      {artists.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                    </select>
                  </div>

                  {needsRelease && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-zinc-500">Release</label>
                      <select
                        value={releaseId}
                        onChange={(e) => setReleaseId(e.target.value)}
                        className="w-full rounded-md border border-zinc-800/60 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                      >
                        <option value="">Select release...</option>
                        {artistReleases.map((r) => (<option key={r.id} value={r.id}>{r.catalogNumber} — {r.title}</option>))}
                      </select>
                    </div>
                  )}

                  {needsDemo && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-zinc-500">Demo</label>
                      <select
                        value={demoId}
                        onChange={(e) => setDemoId(e.target.value)}
                        className="w-full rounded-md border border-amber-500/20 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                      >
                        <option value="">Select demo...</option>
                        {demos.filter((d) => !artistId || artists.find((a) => a.id === artistId)?.name === d.artistName).map((d) => (<option key={d.id} value={d.id}>{d.artistName} — {d.trackTitle}</option>))}
                      </select>
                    </div>
                  )}

                  {needsContract && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-zinc-500">Contract</label>
                      <select
                        value={contractId}
                        onChange={(e) => setContractId(e.target.value)}
                        className="w-full rounded-md border border-violet-500/20 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                      >
                        <option value="">Select contract...</option>
                        {artistContracts.map((c) => (<option key={c.id} value={c.id}>{c.artist} — {c.type.replace(/_/g, " ")}</option>))}
                      </select>
                    </div>
                  )}

                  {!isArAction && (
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-zinc-500">Tone</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as Tone)}
                      className="w-full rounded-md border border-zinc-800/60 bg-zinc-950 px-2.5 py-1.5 text-xs text-white capitalize focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    >
                      {TONES.map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  </div>
                  )}
                  {isArAction && (
                    <div className="rounded-md border border-amber-500/10 bg-amber-500/5 px-3 py-2">
                      <p className="text-[10px] font-medium text-amber-400">A&R Mode</p>
                      <p className="mt-0.5 text-[9px] text-zinc-500">Tone is locked to "direct" — A&R reviews are always honest and evidence-based.</p>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-zinc-500">Context (optional)</label>
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Add specific details..."
                      rows={2}
                      className="w-full rounded-md border border-zinc-800/60 bg-zinc-950 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full rounded-md bg-gradient-to-r from-cyan-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white transition-all duration-200 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>

              {/* Output */}
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Output</p>
                    {provider && (
                      <span className={`rounded px-1 py-0.5 text-[8px] font-medium ${
                        provider === "openrouter" ? "bg-cyan-500/10 text-cyan-400"
                        : provider === "workers-ai" ? "bg-violet-500/10 text-violet-400"
                        : "bg-zinc-500/10 text-zinc-500"
                      }`}>
                        {provider === "openrouter" ? "Llama 3.3" : provider === "workers-ai" ? "Workers AI" : "Template"}
                      </span>
                    )}
                  </div>
                  {output && !output.startsWith("Error") && (
                    <button
                      onClick={() => navigator.clipboard.writeText(output)}
                      className="rounded bg-zinc-800/50 px-2 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300"
                    >
                      Copy
                    </button>
                  )}
                </div>
                <div className="min-h-[100px]">
                  {generating ? (
                    <div className="flex items-center justify-center rounded-md border border-dashed border-zinc-800 p-6">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
                        <p className="text-[10px] text-zinc-500">Generating...</p>
                      </div>
                    </div>
                  ) : output ? (
                    <pre className="whitespace-pre-wrap rounded-md border border-zinc-800/40 bg-zinc-950 p-3 font-sans text-[11px] leading-relaxed text-zinc-300 max-h-[250px] overflow-y-auto">
                      {output}
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center rounded-md border border-dashed border-zinc-800 p-6">
                      <p className="text-[10px] text-zinc-600">
                        Select an action, choose an artist, and Generate
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Full-page mode: 3-column grid ─────────────────────────── */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            <SectionHeader title="Quick Actions" subtitle="Click to select" />
            {actionButtons}
          </div>
          <div className="space-y-6 lg:col-span-2">
            <DashboardCard>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {currentAction?.label ?? "Select an action"}
                  </p>
                  {needsDemo && <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">Uses selected demo</span>}
                  {needsContract && <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">Uses selected contract</span>}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Artist</label>
                    <select
                      value={artistId}
                      onChange={(e) => {
                        setArtistId(e.target.value);
                        setReleaseId(""); setContractId(""); setDemoId("");
                      }}
                      className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    >
                      <option value="">Select artist...</option>
                      {artists.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                    </select>
                  </div>
                  {needsRelease && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Release</label>
                      <select
                        value={releaseId}
                        onChange={(e) => setReleaseId(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                      >
                        <option value="">Select release...</option>
                        {artistReleases.map((r) => (<option key={r.id} value={r.id}>{r.catalogNumber} — {r.title}</option>))}
                      </select>
                    </div>
                  )}
                  {needsDemo && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Demo Submission</label>
                      <select
                        value={demoId}
                        onChange={(e) => setDemoId(e.target.value)}
                        className="w-full rounded-lg border border-amber-500/20 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                      >
                        <option value="">Select demo...</option>
                        {demos.filter((d) => !artistId || artists.find((a) => a.id === artistId)?.name === d.artistName).map((d) => (<option key={d.id} value={d.id}>{d.artistName} — {d.trackTitle} ({d.status})</option>))}
                      </select>
                    </div>
                  )}
                  {needsContract && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Contract</label>
                      <select
                        value={contractId}
                        onChange={(e) => setContractId(e.target.value)}
                        className="w-full rounded-lg border border-violet-500/20 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                      >
                        <option value="">Select contract...</option>
                        {artistContracts.map((c) => (<option key={c.id} value={c.id}>{c.artist} — {c.type.replace(/_/g, " ")} ({c.status})</option>))}
                      </select>
                    </div>
                  )}
                {!isArAction && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white capitalize focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                  >
                    {TONES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                )}
                {isArAction && (
                <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                  <p className="text-[11px] font-medium text-amber-400">A&R Mode</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Tone is locked to "direct" — A&R reviews are always honest and evidence-based.</p>
                </div>
                )}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Extra Context (optional)</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Add any specific details or instructions..."
                    rows={2}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? "Generating..." : "Generate"}
                </button>
              </div>
            </DashboardCard>
            <DashboardCard>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Output</p>
                  {provider && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${provider === "openrouter" ? "bg-cyan-500/10 text-cyan-400" : provider === "workers-ai" ? "bg-violet-500/10 text-violet-400" : "bg-zinc-500/10 text-zinc-500"}`}>
                      {provider === "openrouter" ? "Llama 3.3" : provider === "workers-ai" ? "Workers AI" : "Template"}
                    </span>
                  )}
                </div>
                {output && !output.startsWith("Error") && (
                  <button onClick={() => navigator.clipboard.writeText(output)} className="rounded bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300">Copy</button>
                )}
              </div>
              <div className="mt-3 min-h-[200px]">
                {generating ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-800 p-8">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
                      <p className="text-xs text-zinc-500">Generating...</p>
                    </div>
                  </div>
                ) : output ? (
                  <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-4 font-sans text-xs leading-relaxed text-zinc-300">{output}</pre>
                ) : (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-800 p-8">
                    <p className="text-xs text-zinc-600">Select an action, choose an artist, and click Generate</p>
                  </div>
                )}
              </div>
            </DashboardCard>
          </div>
        </div>
      )}
    </div>
  );
}
