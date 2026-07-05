// Vocabulary + presets shared between AIAssistantPage, CampaignIntelligencePage,
// and ContentStudioPage. Generation logic now lives server-side at
// /api/ai/generate (OpenRouter Llama 3.3 → Workers AI fallback).
// This module exports only the enums / labels that the components reference.

export type Tone = "professional" | "underground" | "emotional" | "cinematic" | "direct" | "premium" | "friendly" | "minimal";

export const TONES: Tone[] = [
  "professional", "underground", "emotional", "cinematic", "direct", "premium", "friendly", "minimal",
];

export const CONTENT_TYPES = [
  { id: "instagram_caption", label: "Instagram Caption", icon: "◈" },
  { id: "artist_spotlight", label: "Artist Spotlight", icon: "✦" },
  { id: "release_announcement", label: "Release Announcement", icon: "▣" },
  { id: "beatport_description", label: "Beatport Description", icon: "◈" },
  { id: "spotify_pitch", label: "Spotify Pitch", icon: "◈" },
  { id: "youtube_description", label: "YouTube Description", icon: "◐" },
  { id: "press_release", label: "Press Release", icon: "◆" },
  { id: "email_template", label: "Email Template", icon: "✉" },
  { id: "promo_blurb", label: "Promo Blurb", icon: "◉" },
  { id: "dj_promo_message", label: "DJ Promo Message", icon: "◉" },
  { id: "demo_feedback_email", label: "Demo Feedback Email", icon: "▷" },
  { id: "artist_onboarding_email", label: "Artist Onboarding Email", icon: "✉" },
  { id: "contract_follow_up_email", label: "Contract Follow-up Email", icon: "✉" },
  { id: "release_description", label: "Release Description", icon: "▣" },
] as const;

export const PRESET_ACTIONS = [
  { id: "draft_release_description", label: "Draft Release Description", icon: "▣" },
  { id: "create_beatport_pitch", label: "Create Beatport Pitch", icon: "◈" },
  { id: "generate_spotify_pitch", label: "Generate Spotify Pitch", icon: "◈" },
  { id: "write_instagram_caption", label: "Write Instagram Caption", icon: "◈" },
  { id: "create_artist_spotlight", label: "Create Artist Spotlight", icon: "✦" },
  { id: "generate_campaign_plan", label: "Generate Campaign Plan", icon: "📅" },
  { id: "draft_contract_notes", label: "Draft Contract Notes", icon: "◇" },
  { id: "check_release_readiness", label: "Check Release Readiness", icon: "◉" },
  { id: "build_promo_plan", label: "Build Promo Plan", icon: "◉" },
  { id: "suggest_next_actions", label: "Suggest Next Actions", icon: "◆" },
  { id: "summarize_artist_profile", label: "Summarize Artist Profile", icon: "◈" },
  { id: "create_launch_checklist", label: "Create Launch Checklist", icon: "▣" },
  { id: "generate_email_to_artist", label: "Generate Email to Artist", icon: "✉" },
  { id: "generate_email_to_distributor", label: "Generate Email to Distributor", icon: "✉" },
  { id: "generate_dj_promo_text", label: "Generate DJ Promo Text", icon: "◉" },
  { id: "generate_youtube_description", label: "Generate YouTube Description", icon: "◐" },
  { id: "generate_press_release", label: "Generate Press Release", icon: "◆" },
  { id: "generate_demo_feedback", label: "Generate Demo Feedback", icon: "▷" },
  { id: "generate_rejection_email", label: "Generate Rejection Email", icon: "✉" },
  { id: "generate_interest_email", label: "Generate Interest Email", icon: "✉" },
  // ── A&R Label Manager actions (ar-label-manager skill) ──────────
  { id: "ar_demo_review", label: "A&R Demo Review", icon: "🔍" },
  { id: "ar_artist_analysis", label: "A&R Artist Analysis", icon: "📊" },
] as const;
