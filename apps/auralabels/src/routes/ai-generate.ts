/**
 * AI content generation route.
 *
 * Primary:   Llama 3.3 70B via OpenRouter (free tier)
 * Fallback:  Workers AI (@cf/meta/llama-3.1-8b-instruct, always-on)
 *
 * The server tries OpenRouter first; if it's unavailable (no key,
 * rate-limited, network error), it falls back to Workers AI transparently.
 * The client doesn't need to pick a provider — the server handles the
 * cascade internally.
 *
 * POST /api/ai/generate
 * Body: { prompt: string; maxTokens?: number; model?: string }
 * Returns: { status: "ok", result: string, provider: "openrouter" | "workers-ai" }
 */
import { jsonOk, jsonBadRequest, jsonError } from "./helpers.js";
import type { CorsHeaders } from "./helpers.js";
import type { Env } from "../env.js";

// ── Defaults ────────────────────────────────────────────────────────────────

const OPENROUTER_PRIMARY_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const WORKERS_AI_FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const DEFAULT_MAX_TOKENS = 512;
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// ── Provider implementations ────────────────────────────────────────────────

async function generateWithOpenRouter(
  env: Env,
  prompt: string,
  model: string,
  maxTokens: number,
): Promise<unknown> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured");
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://auralabels.app",
      "X-Title": "AURA Labels",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenRouter API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data?.choices?.[0]?.message?.content ?? "";
}

async function generateWithWorkersAI(
  env: Env,
  prompt: string,
  model: string,
  maxTokens: number,
): Promise<unknown> {
  if (!env.AI) {
    throw new Error("Workers AI binding not configured — add [ai] in wrangler.toml");
  }
  return env.AI.run(model, {
    prompt,
    max_tokens: maxTokens,
    stream: false,
  });
}

// ── Result extraction ───────────────────────────────────────────────────────

function extractText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "response" in raw) {
    const r = (raw as Record<string, unknown>).response;
    if (typeof r === "string") return r;
  }
  return JSON.stringify(raw);
}

// ── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Construct a prompt from the structured AIGenerateRequest format sent by the
 * frontend (AIAssistantPage / CampaignIntelligencePage). Falls back to the raw
 * `prompt` field for backwards compatibility with direct API callers.
 */
function buildPrompt(body: Record<string, unknown>): string | null {
  // If a raw prompt was provided, use it directly
  if (
    typeof body.prompt === "string" &&
    body.prompt.trim().length > 0
  ) {
    return body.prompt.trim();
  }

  const actionType =
    typeof body.actionType === "string" ? body.actionType.trim() : "";
  if (!actionType) return null;

  const tone =
    typeof body.tone === "string" ? body.tone.trim() : "professional";
  const context =
    typeof body.context === "string" ? body.context.trim() : "";

  const artist = body.artist as Record<string, unknown> | null | undefined;
  const release = body.release as Record<string, unknown> | null | undefined;
  const demo = body.demo as Record<string, unknown> | null | undefined;
  const contract = body.contract as Record<string, unknown> | null | undefined;

  // Action label map for human-readable descriptions
  const actionLabels: Record<string, string> = {
    draft_release_description: "Write a release description",
    create_beatport_pitch: "Write a Beatport pitch",
    generate_spotify_pitch: "Write a Spotify pitch",
    write_instagram_caption: "Write an Instagram caption",
    create_artist_spotlight: "Write an artist spotlight",
    generate_campaign_plan: "Create a campaign plan",
    draft_contract_notes: "Draft contract notes",
    check_release_readiness: "Assess release readiness",
    build_promo_plan: "Build a promo plan",
    suggest_next_actions: "Suggest next actions",
    summarize_artist_profile: "Summarize the artist profile",
    create_launch_checklist: "Create a launch checklist",
    generate_email_to_artist: "Write an email to the artist",
    generate_email_to_distributor: "Write an email to the distributor",
    generate_dj_promo_text: "Write a DJ promo message",
    generate_youtube_description: "Write a YouTube description",
    generate_press_release: "Write a press release",
    generate_demo_feedback: "Write demo feedback",
    generate_rejection_email: "Write a rejection email to the artist",
    generate_interest_email: "Write an interest email to the artist",
    // ── A&R Label Manager actions (ar-label-manager skill) ──────────
    ar_demo_review: "Review this demo submission",
    ar_artist_analysis: "Analyze this artist for the roster",
  };

  const actionLabel = actionLabels[actionType] ?? `Write content for ${actionType.replace(/_/g, " ")}`;

  const parts: string[] = [];
  const isArAction = actionType.startsWith("ar_");

  if (isArAction) {
    // ── A&R Label Manager skill (ar-label-manager) scoring framework ──
    parts.push(
      `Role: You are a senior A&R Label Manager with 20+ years of experience in electronic music labels. ` +
      `You work for the label, not the artist. Your job is to protect the label's time, money, and brand. ` +
      `Be brutally honest, specific, and evidence-based. Separate strengths from weaknesses clearly. ` +
      `State uncertainty when data is thin. Avoid hype and unsupported assumptions.`
    );
    parts.push(`Task: ${actionLabel} with a full A&R assessment.`);
    parts.push(`Tone: direct and honest. Write in a direct, no-nonsense tone appropriate for A&R decision-making.`);
  } else {
    parts.push(`Role: You are a professional A&R assistant for an independent record label.`);
    parts.push(`Task: ${actionLabel}.`);
    parts.push(`Tone: ${tone}. Write in a ${tone} tone appropriate for the music industry.`);
  }

  if (artist && typeof artist === "object") {
    const name = artist.name;
    const label = artist.label;
    const genres = Array.isArray(artist.genres) ? artist.genres.join(", ") : "";
    const bio = artist.bio;
    const releases = artist.totalReleases;
    const signedSince = artist.signedSince;

    parts.push(`\nArtist context:`);
    if (name) parts.push(`  Name: ${name}`);
    if (label) parts.push(`  Label: ${label}`);
    if (genres) parts.push(`  Genres: ${genres}`);
    if (bio) parts.push(`  Bio: ${bio}`);
    if (releases !== undefined && releases !== null) parts.push(`  Total releases: ${releases}`);
    if (signedSince) parts.push(`  Signed since: ${signedSince}`);
  }

  if (release && typeof release === "object") {
    const title = release.title;
    const catalog = release.catalogNumber;
    const genres = Array.isArray(release.genres) ? release.genres.join(", ") : "";
    const date = release.releaseDate;
    const tracks = Array.isArray(release.tracks) ? release.tracks : [];
    const checklist = Array.isArray(release.launchChecklist) ? release.launchChecklist : [];
    const readiness = release.readinessPercentage;

    parts.push(`\nRelease context:`);
    if (title) parts.push(`  Title: ${title}`);
    if (catalog) parts.push(`  Catalog: ${catalog}`);
    if (genres) parts.push(`  Genres: ${genres}`);
    if (date) parts.push(`  Release date: ${date}`);
    if (tracks.length > 0) {
      const trackList = tracks
        .map((t: Record<string, unknown>) => `${t.title ?? "Untitled"}${t.bpm ? ` (${t.bpm} BPM)` : ""}`)
        .join(", ");
      parts.push(`  Tracks: ${trackList}`);
    }
    if (readiness !== undefined && readiness !== null) parts.push(`  Readiness: ${readiness}%`);
    if (checklist.length > 0) {
      const completed = checklist.filter((c: Record<string, unknown>) => c.completed).length;
      const total = checklist.length;
      parts.push(`  Launch checklist: ${completed}/${total} items completed`);
    }
  }

  if (demo && typeof demo === "object") {
    const artistName = demo.artistName;
    const trackTitle = demo.trackTitle;
    const genre = demo.genre;
    const rating = demo.rating;
    const notes = demo.notes;
    const status = demo.status;

    parts.push(`\nDemo context:`);
    if (artistName) parts.push(`  Artist: ${artistName}`);
    if (trackTitle) parts.push(`  Track: ${trackTitle}`);
    if (genre) parts.push(`  Genre: ${genre}`);
    if (status) parts.push(`  Status: ${status}`);
    if (rating !== undefined && rating !== null) parts.push(`  Rating: ${rating}/5`);
    if (notes) parts.push(`  Notes: ${notes}`);
  }

  if (contract && typeof contract === "object") {
    const cArtist = contract.artist;
    const cType = contract.type;
    const cStatus = contract.status;
    const revenueShare = contract.revenueShare;
    const value = contract.value;
    const rights = contract.rights;
    const signedDate = contract.signedDate;
    const expiryDate = contract.expiryDate;
    const cNotes = contract.notes;

    parts.push(`\nContract context:`);
    if (cArtist) parts.push(`  Artist: ${cArtist}`);
    if (cType) parts.push(`  Type: ${cType}`);
    if (cStatus) parts.push(`  Status: ${cStatus}`);
    if (revenueShare !== undefined && revenueShare !== null) parts.push(`  Revenue share: ${revenueShare}%`);
    if (value !== undefined && value !== null) parts.push(`  Value: $${value}`);
    if (rights) parts.push(`  Rights: ${rights}`);
    if (signedDate) parts.push(`  Signed: ${signedDate}`);
    if (expiryDate) parts.push(`  Expires: ${expiryDate}`);
    if (cNotes) parts.push(`  Notes: ${cNotes}`);
  }

  if (context) {
    parts.push(`\nAdditional context: ${context}`);
  }

  if (isArAction) {
    // ── A&R Label Manager output structure ──
    parts.push(
      `\nOutput structure — follow this format exactly:\n\n` +
      `## Executive Summary\nOne paragraph that captures the overall verdict.\n\n` +
      `## Analysis\nScore each dimension from 1-10 with a brief justification:\n` +
      `- Production: X/10 — [reason]\n` +
      `- Originality: X/10 — [reason]\n` +
      `- Mix: X/10 — [reason]\n` +
      `- Mastering: X/10 — [reason]\n` +
      `- Branding: X/10 — [reason]\n` +
      `- Commercial viability: X/10 — [reason]\n\n` +
      `## Genre Fit\n[Good / Moderate / Poor] — [why]\n\n` +
      `## Label Fit\n[Perfect / Good / Moderate / Poor] — [why]\n\n` +
      `## Go / Maybe / Reject\n[Decision] — [rationale]\n\n` +
      `## Strengths\n- [strength 1]\n- [strength 2]\n\n` +
      `## Weaknesses\n- [weakness 1]\n- [weakness 2]\n\n` +
      `## Risks\n- [risk 1]\n- [risk 2]\n\n` +
      `## Recommendations\n- [recommendation 1]\n- [recommendation 2]\n\n` +
      `## Priority Actions\n1. [action 1]\n2. [action 2]\n\n` +
      `## Confidence\n[High / Medium / Low] — [why]`
    );
  } else {
    parts.push(`\nWrite the output in plain text without markdown formatting. Be concise and specific to the context provided.`);
  }

  return parts.join("\n");
}

// ── Handler ─────────────────────────────────────────────────────────────────

// Note: the optional `model` body param only applies to the OpenRouter
// attempt. On fallback to Workers AI the hardcoded WORKERS_AI_FALLBACK_MODEL
// is always used — Workers AI has a limited model catalog and the client
// shouldn't need to micro-manage the fallback model.
export async function aiGenerateHandler(
  req: Request,
  env: Env,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonError("Method not allowed", corsHeaders);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    // Support both raw prompt format and structured AIGenerateRequest format
    const prompt = buildPrompt(body);

    if (!prompt) {
      return jsonBadRequest("Missing required field: prompt or actionType", corsHeaders);
    }

    const maxTokens =
      typeof body.maxTokens === "number"
        ? body.maxTokens
        : DEFAULT_MAX_TOKENS;

    // Cascade: try OpenRouter (Llama 3.3 70B) first, fall back to Workers AI.
    let raw: unknown;
    let provider: string;

    try {
      raw = await generateWithOpenRouter(
        env,
        prompt,
        typeof body.model === "string" ? body.model : OPENROUTER_PRIMARY_MODEL,
        maxTokens,
      );
      provider = "openrouter";
    } catch (openRouterErr) {
      console.warn("[ai] OpenRouter unavailable, falling back to Workers AI:", openRouterErr);
      try {
        raw = await generateWithWorkersAI(
          env,
          prompt,
          WORKERS_AI_FALLBACK_MODEL,
          maxTokens,
        );
        provider = "workers-ai";
      } catch (workersErr) {
        console.error("[ai] Both providers failed:", { openRouter: openRouterErr, workers: workersErr });
        throw new Error("AI generation unavailable — both OpenRouter and Workers AI are down", { cause: workersErr });
      }
    }

    const text = extractText(raw);
    return jsonOk({ status: "ok", result: text, provider }, corsHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    console.error("[ai] Generation error:", err);
    return jsonError(message, corsHeaders);
  }
}
