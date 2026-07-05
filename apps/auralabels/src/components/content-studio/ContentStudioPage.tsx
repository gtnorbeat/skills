import { useState, useEffect, useMemo } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { generateAI, fetchArtists, fetchReleases } from "@/utils/api";
import { useToast } from "@/components/ui/Toast";
import { CONTENT_TYPES, TONES } from "@/utils/aiMock";
import type { Tone } from "@/utils/aiMock";
import type { Artist, Release } from "@/types";

type Length = "short" | "medium" | "long";

const LENGTHS: { id: Length; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

// Platform vocabulary reused from CampaignIntelligencePage. Server matches
// these ids against PLATFORM_GUIDANCE — unknown ids are treated as generic.
const PLATFORMS = [
  { id: "instagram",  label: "Instagram" },
  { id: "youtube",    label: "YouTube" },
  { id: "spotify",    label: "Spotify" },
  { id: "beatport",   label: "Beatport" },
  { id: "tiktok",     label: "TikTok" },
  { id: "soundcloud", label: "SoundCloud" },
  { id: "radio",      label: "Radio" },
  { id: "press",      label: "Press" },
  { id: "email",      label: "Email" },
  { id: "generic",    label: "Generic / Multi-channel" },
] as const;

// Auto-default the Platform <select> when the user picks a content type.
// The user is still free to override — this just removes a click on the
// happy path. Content types without an obvious channel map to "" (no
// platform) so the server uses its channel-neutral copy.
const CONTENT_TYPE_DEFAULT_PLATFORM: Record<string, string> = {
  instagram_caption: "instagram",
  youtube_description: "youtube",
  spotify_pitch: "spotify",
  beatport_description: "beatport",
  dj_promo_message: "email",
  email_template: "email",
  demo_feedback_email: "email",
  artist_onboarding_email: "email",
  contract_follow_up_email: "email",
  press_release: "press",
  release_announcement: "soundcloud",
  promo_blurb: "soundcloud",
  artist_spotlight: "generic",
  release_description: "generic",
};

const ACTION_TYPE_MAP: Record<string, string> = {
  instagram_caption: "write_instagram_caption",
  artist_spotlight: "create_artist_spotlight",
  release_announcement: "draft_release_description",
  beatport_description: "create_beatport_pitch",
  spotify_pitch: "generate_spotify_pitch",
  youtube_description: "generate_youtube_description",
  press_release: "generate_press_release",
  email_template: "generate_email_to_artist",
  promo_blurb: "build_promo_plan",
  dj_promo_message: "generate_dj_promo_text",
  demo_feedback_email: "generate_demo_feedback",
  artist_onboarding_email: "generate_email_to_artist",
  contract_follow_up_email: "generate_interest_email",
  release_description: "draft_release_description",
};

function providerPill(provider: string | null): { label: string; classes: string } | null {
  if (!provider || provider === "error") return null;
  if (provider === "openrouter") return { label: "Llama 3.3", classes: "bg-cyan-500/10 text-cyan-400" };
  if (provider === "workers-ai") return { label: "Workers AI", classes: "bg-violet-500/10 text-violet-400" };
  return { label: "Template", classes: "bg-zinc-500/10 text-zinc-500" };
}

export function ContentStudioPage() {
  const { toast } = useToast();

  const [contentType, setContentType] = useState<string>(CONTENT_TYPES[0].id);
  // Default to empty strings — previously these were hardcoded "artist-001"
  // and "release-001" from the deleted mock seed. Once live data arrives
  // (below), the empty defaults are replaced with the first available id.
  const [artistId, setArtistId] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [length, setLength] = useState<Length>("medium");
  const [context, setContext] = useState("");
  const [platform, setPlatform] = useState<string>(CONTENT_TYPE_DEFAULT_PLATFORM[CONTENT_TYPES[0].id] ?? "");
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Suggest a sensible default platform whenever the content type changes.
  useEffect(() => {
    const next = CONTENT_TYPE_DEFAULT_PLATFORM[contentType] ?? "";
    setPlatform(next);
    setOutput("");
    setProvider(null);
  }, [contentType]);

  // Fetch artists + releases once on mount. The previous version used
  // mockArrays directly in JSX; this version reads from the live /api
  // endpoints and mirrors the same "first row wins" default that the
  // original hard-coded id did. Defaults are applied only after the
  // fetch resolves to avoid a flash of mismatched ids.
  useEffect(() => {
    let mounted = true;
    Promise.all([fetchArtists(), fetchReleases()])
      .then(([a, r]) => {
        if (!mounted) return;
        setArtists(a);
        setReleases(r);
        // Only seed defaults if the user hasn't chosen yet — using length
        // check keeps a user override (typed-in id) from being clobbered
        // by a later re-render. Empty string is the canonical "not yet
        // chosen" sentinel.
        setArtistId((cur) => cur || a[0]?.id || "");
        setReleaseId((cur) => cur || r[0]?.id || "");
      })
      .catch(() => {
        // Silent fail — the UI shows "no artists / releases available"
        // below; the toast is reserved for explicit user actions.
      })
      .finally(() => {
        if (mounted) setLoadingData(false);
      });
    return () => { mounted = false; };
  }, []);

  // Releases filtered to the selected artist (when one is picked).
  // Empty artistId returns the full list so the user can disambiguate
  // by release id without picking an artist first.
  const filteredReleases = useMemo(
    () => artistId ? releases.filter((r) => r.artistId === artistId || r.artistId === "")
      : releases,
    [releases, artistId],
  );

  const currentType = CONTENT_TYPES.find((t) => t.id === contentType);
  const currentPlatform = PLATFORMS.find((p) => p.id === platform);

  // Disable Generate when the user has no artist + no release + no data
  // yet — dead-state button would otherwise spin and surface a 4xx in
  // toast. Server has fallback names so submit always works; the disable
  // is purely UX (don't tempt the user to generate nothing).
  const canGenerate = (artists.length > 0 || artistId !== "") && (releases.length > 0 || releaseId !== "");

  async function handleGenerate() {
    const actionType = ACTION_TYPE_MAP[contentType] ?? "draft_release_description";
    const artist = artists.find((a) => a.id === artistId) ?? null;
    const release = releases.find((r) => r.id === releaseId) ?? null;

    setGenerating(true);
    setOutput("");
    setProvider(null);

    const lengthHint = length === "short"
      ? " Keep it concise."
      : length === "long"
        ? " Be comprehensive and detailed."
        : " Stay medium-length, around 200-500 words.";

    try {
      const result = await generateAI({
        actionType,
        artist,
        release,
        demo: null,
        contract: null,
        tone,
        context: `${context ?? ""}${lengthHint}`.trim(),
        platform: platform || undefined,
      });
      setOutput(result.content);
      setProvider(result.provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generation failed";
      toast.error(`Generation failed: ${message}`);
      setProvider("error");
    } finally {
      setGenerating(false);
    }
  }

  const pill = providerPill(provider);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Content Studio"
        subtitle="Generate polished, platform-tailored content for your label's channels"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar — Content types */}
        <div className="space-y-3 lg:col-span-1">
          <SectionHeader title="Content Types" subtitle="What to create" />
          <div className="grid grid-cols-1 gap-1">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setContentType(type.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all duration-200 ${
                  contentType === type.id
                    ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
                }`}
              >
                <span className="text-sm">{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main — Controls + Output */}
        <div className="space-y-6 lg:col-span-3">
          <DashboardCard>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {currentType?.label ?? "Select content type"}
                </p>
                {currentPlatform && (
                  <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                    Target: {currentPlatform.label}
                  </span>
                )}
              </div>

              {loadingData ? (
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
                  <p className="text-xs text-zinc-500">Loading artists + releases…</p>
                </div>
              ) : artists.length === 0 ? (
                <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
                  <p className="text-xs font-medium text-amber-300">No artists yet</p>
                  <p className="mt-1 text-[11px] text-amber-200/70">
                    Add an artist on the Artists page before generating content.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Artist */}
                  <div>
                    <label htmlFor="cs-artist" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                      Artist
                    </label>
                    <select
                      id="cs-artist"
                      value={artistId}
                      onChange={(e) => {
                        setArtistId(e.target.value);
                        setReleaseId("");
                      }}
                      className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    >
                      <option value="">Select…</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Release */}
                  <div>
                    <label htmlFor="cs-release" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                      Release
                    </label>
                    <select
                      id="cs-release"
                      value={releaseId}
                      onChange={(e) => setReleaseId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    >
                      <option value="">Select…</option>
                      {filteredReleases.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.catalogNumber} — {r.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tone */}
                  <div>
                    <label htmlFor="cs-tone" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                      Tone
                    </label>
                    <select
                      id="cs-tone"
                      value={tone}
                      onChange={(e) => setTone(e.target.value as Tone)}
                      className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white capitalize focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    >
                      {TONES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Platform — actually drives the output via /api/ai/generate */}
                  <div>
                    <label htmlFor="cs-platform" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                      Platform
                    </label>
                    <select
                      id="cs-platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                    >
                      <option value="">— No channel —</option>
                      {PLATFORMS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Length (separate row so the 4-col select grid stays clean) */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                  Output Length
                </label>
                <div className="flex gap-2">
                  {LENGTHS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLength(l.id)}
                      aria-label={`${l.label} output length`}
                      aria-pressed={length === l.id}
                      className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-medium transition-all ${
                        length === l.id
                          ? "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30"
                          : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context */}
              <div>
                <label htmlFor="cs-context" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                  Extra Context (optional)
                </label>
                <textarea
                  id="cs-context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Add any specific details or instructions..."
                  rows={2}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? "Generating…" : "Generate Content"}
              </button>
            </div>
          </DashboardCard>

          {/* Output */}
          <DashboardCard>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Output
                </p>
                {pill && (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${pill.classes}`}>
                    {pill.label}
                  </span>
                )}
                {provider === "error" && (
                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-medium text-red-400">
                    Error
                  </span>
                )}
              </div>
              {output && !generating && (
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  className="rounded bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Copy
                </button>
              )}
            </div>
            <div className="mt-3 min-h-[200px]">
              {generating ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-400" />
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Generating for {currentPlatform?.label ?? "generic channel"}...
                  </p>
                </div>
              ) : output ? (
                <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-4 font-sans text-xs leading-relaxed text-zinc-300">
                  {output}
                </pre>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-800 p-8">
                  <p className="text-xs text-zinc-600">
                    Select content type, configure platform + options, and click Generate
                  </p>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
