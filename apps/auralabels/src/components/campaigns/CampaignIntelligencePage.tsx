import { useState, useEffect } from "react";
import type { Artist, Release } from "@/types";
import { fetchArtists, fetchReleases, generateAI } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { TONES } from "@/utils/aiMock";
import type { Tone } from "@/utils/aiMock";

const CONTENT_PIECES = [
  { id: "write_instagram_caption", label: "Instagram Caption", icon: "📱", phase: "launch" },
  { id: "generate_dj_promo_text", label: "DJ Promo Email", icon: "🎧", phase: "build" },
  { id: "generate_spotify_pitch", label: "Spotify Pitch", icon: "🎵", phase: "build" },
  { id: "generate_press_release", label: "Press Release", icon: "📰", phase: "sustain" },
  { id: "generate_youtube_description", label: "YouTube Description", icon: "▶️", phase: "sustain" },
  { id: "draft_release_description", label: "Beatport Description", icon: "◈", phase: "build" },
] as const;

const PHASES = [
  { id: "tease", label: "Week 1 — Tease", color: "bg-zinc-700" },
  { id: "build", label: "Week 2 — Build", color: "bg-cyan-500/30" },
  { id: "launch", label: "Week 3 — Launch", color: "bg-emerald-500/30" },
  { id: "sustain", label: "Week 4 — Sustain", color: "bg-violet-500/30" },
];

export function CampaignIntelligencePage() {
  // Live data
  const { isOnline } = useNetworkStatus();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [artistId, setArtistId] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [tone, setTone] = useState<Tone>("professional");

  // Context
  const [context, setContext] = useState("");

  // Generation state
  const [campaignPlan, setCampaignPlan] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatedPieces, setGeneratedPieces] = useState<Record<string, string>>({});
  const [pieceProviders, setPieceProviders] = useState<Record<string, string>>({});
  const [generatingPiece, setGeneratingPiece] = useState<string | null>(null);
  const [activePiece, setActivePiece] = useState<string | null>(null);
  const [planProvider, setPlanProvider] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [fetchedArtists, fetchedReleases] = await Promise.all([
          fetchArtists(),
          fetchReleases(),
        ]);
        if (cancelled) return;
        setArtists(fetchedArtists);
        setReleases(fetchedReleases);
        if (fetchedArtists.length > 0) setArtistId(fetchedArtists[0].id);
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

  const artistReleases = releases.filter(
    (r) => r.artistId === artistId || artistId === ""
  );

  const currentArtist = artists.find((a) => a.id === artistId) ?? null;
  const currentRelease = releases.find((r) => r.id === releaseId) ?? null;

  // Generate full campaign plan
  async function handleGeneratePlan() {
    if (!currentRelease || !currentArtist) return;
    setGeneratingPlan(true);
    setCampaignPlan(null);
    setGeneratedPieces({});
    setPieceProviders({});
    setActivePiece(null);
    setPlanProvider(null);

    try {
      const result = await generateAI({
        actionType: "generate_campaign_plan",
        artist: currentArtist,
        release: currentRelease,
        tone,
        context: context || undefined,
      });
      setCampaignPlan(result.content);
      setPlanProvider(result.provider);
    } catch (err) {
      setCampaignPlan(`Error: ${err instanceof Error ? err.message : "Generation failed"}`);
    } finally {
      setGeneratingPlan(false);
    }
  }

  // Generate a single content piece
  async function handleGeneratePiece(pieceId: string) {
    if (!currentRelease || !currentArtist) return;
    setGeneratingPiece(pieceId);

    try {
      const result = await generateAI({
        actionType: pieceId,
        artist: currentArtist,
        release: currentRelease,
        tone,
        context: context || undefined,
      });
      setGeneratedPieces((prev) => ({ ...prev, [pieceId]: result.content }));
      setPieceProviders((prev) => ({ ...prev, [pieceId]: result.provider }));
      setActivePiece(pieceId);
    } catch (err) {
      setGeneratedPieces((prev) => ({ ...prev, [pieceId]: `Error: ${err instanceof Error ? err.message : "Generation failed"}` }));
      setPieceProviders((prev) => ({ ...prev, [pieceId]: "error" }));
      setActivePiece(pieceId);
    } finally {
      setGeneratingPiece(null);
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

  const hasSelection = currentArtist && currentRelease;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Campaign Intelligence"
        subtitle="Turn every release into a structured promotional campaign with AI-generated content"
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Left sidebar — Controls */}
        <div className="space-y-4 xl:col-span-1">
          <DashboardCard>
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Campaign Setup
              </p>

              {/* Artist */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                  Artist
                </label>
                <select
                  value={artistId}
                  onChange={(e) => { setArtistId(e.target.value); setReleaseId(""); setCampaignPlan(null); setGeneratedPieces({}); setActivePiece(null); }}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">Select artist...</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Release */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                  Release
                </label>
                <select
                  value={releaseId}
                  onChange={(e) => { setReleaseId(e.target.value); setCampaignPlan(null); setGeneratedPieces({}); setActivePiece(null); }}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">Select release...</option>
                  {artistReleases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.catalogNumber} — {r.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tone */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                  Campaign Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white capitalize outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Context */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                  Extra Context (optional)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="E.g. focus on Instagram Reels, target Berlin clubs, underground-only promo..."
                  rows={2}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>

              {/* Generate campaign button */}
              <button
                onClick={handleGeneratePlan}
                disabled={!hasSelection || generatingPlan}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingPlan ? "Generating Campaign..." : "Generate Campaign Plan"}
              </button>

              {/* Release info */}
              {currentRelease && (
                <div className="rounded-lg border border-zinc-800/30 bg-zinc-900/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    {currentRelease.catalogNumber}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-zinc-200">{currentRelease.title}</p>
                  <p className="text-[10px] text-zinc-600">
                    {currentRelease.artist} · {currentRelease.genres.join(", ")}
                  </p>
                  {currentRelease.tracks.length > 0 && (
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {currentRelease.tracks[0].bpm} BPM · {currentRelease.tracks[0].key} · {currentRelease.tracks.length} track{currentRelease.tracks.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Right main — Campaign + Content */}
        <div className="space-y-6 xl:col-span-3">
          {/* Campaign Plan */}
          {campaignPlan && (
            <DashboardCard>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Campaign Plan
                  </p>
                  {planProvider && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      planProvider === "openrouter"
                        ? "bg-cyan-500/10 text-cyan-400"
                        : planProvider === "workers-ai"
                          ? "bg-violet-500/10 text-violet-400"
                          : "bg-zinc-500/10 text-zinc-500"
                    }`}>
                      {planProvider === "openrouter" ? "Llama 3.3" : planProvider === "workers-ai" ? "Workers AI" : "Template"}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(campaignPlan)}
                  className="rounded bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Copy Plan
                </button>
              </div>
              <div className="mt-3">
                <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-4 font-sans text-xs leading-relaxed text-zinc-300">
                  {campaignPlan}
                </pre>
              </div>
            </DashboardCard>
          )}

          {/* Content Pieces Grid */}
          {campaignPlan && (
            <div>
              <SectionHeader
                title="Content Pieces"
                subtitle="Generate each piece of your campaign"
              />

              {/* Phase columns */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {PHASES.map((phase) => {
                  const phasePieces = CONTENT_PIECES.filter((p) => p.phase === phase.id);
                  return (
                    <div key={phase.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${phase.color}`} />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                          {phase.label}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {phasePieces.map((piece) => {
                          const isGenerated = !!generatedPieces[piece.id];
                          const isActive = activePiece === piece.id;
                          const isLoading = generatingPiece === piece.id;
                          return (
                            <button
                              key={piece.id}
                              onClick={() => isGenerated ? setActivePiece(piece.id) : handleGeneratePiece(piece.id)}
                              disabled={isLoading || !hasSelection}
                              className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-all duration-200 ${
                                isActive && isGenerated
                                  ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                                  : isGenerated
                                    ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 hover:bg-emerald-500/15"
                                    : "bg-zinc-800/30 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{piece.icon}</span>
                                <span className="flex-1">{piece.label}</span>
                                {isLoading && (
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
                                )}
                                {isGenerated && !isActive && (
                                  <span className="text-[9px] text-emerald-500/60">✓</span>
                                )}
                                {isActive && isGenerated && (
                                  <span className="text-[9px] text-cyan-400">◀</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Piece Output */}
          {activePiece && generatedPieces[activePiece] && (
            <DashboardCard>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {CONTENT_PIECES.find((p) => p.id === activePiece)?.label ?? "Generated Content"}
                  </p>
                  {pieceProviders[activePiece] && pieceProviders[activePiece] !== "error" && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      pieceProviders[activePiece] === "openrouter"
                        ? "bg-cyan-500/10 text-cyan-400"
                        : pieceProviders[activePiece] === "workers-ai"
                          ? "bg-violet-500/10 text-violet-400"
                          : "bg-zinc-500/10 text-zinc-500"
                    }`}>
                      {pieceProviders[activePiece] === "openrouter" ? "Llama 3.3" : pieceProviders[activePiece] === "workers-ai" ? "Workers AI" : "Template"}
                    </span>
                  )}
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                    Ready
                  </span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedPieces[activePiece])}
                  className="rounded bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Copy
                </button>
              </div>
              <div className="mt-3">
                <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-4 font-sans text-xs leading-relaxed text-zinc-300">
                  {generatedPieces[activePiece]}
                </pre>
              </div>
            </DashboardCard>
          )}

          {/* Empty state */}
          {!campaignPlan && (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-20">
              <div className="text-center max-w-md">
                <span className="text-3xl text-zinc-700 aura-float">📅</span>
                <p className="mt-3 text-sm font-medium text-zinc-400">No campaign generated yet</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Select an artist and release, then click "Generate Campaign Plan" to create a full promotional campaign with AI-generated content for every phase.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
