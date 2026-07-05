#!/usr/bin/env node
/**
 * Seed script — inserts ORBEAT Records demo data via the API.
 *
 * Usage:
 *   source ../../.env  # get DATABASE_URL (not needed — uses API)
 *   node scripts/seed-demo.mjs
 *
 * This script:
 *   1. Logs in as admin to get a JWT
 *   2. Creates artists from the ORBEAT roster
 *   3. Creates releases
 *   4. Creates demo submissions
 *   5. Creates contracts
 *   6. Creates tasks
 *   7. Creates a promo campaign
 */

const API_BASE = process.env.API_BASE || "https://auralabels.app";
const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AuraAdmin2026!";

// ── Helpers ──────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`  ✗ ${res.status} ${path}: ${data.message || res.statusText}`);
    return null;
  }
  return data;
}

async function authPost(path, token, body) {
  return api(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── ORBEAT Records roster data ───────────────────────────────────────

const ARTISTS = [
  {
    name: "GTN-O",
    label: "ORBEAT Records",
    status: "active",
    genres: ["Progressive House", "Melodic Techno"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/gtno" },
      { platform: "Instagram", url: "https://instagram.com/gtno" },
      { platform: "Spotify", url: "https://open.spotify.com/artist/gtno" },
    ],
    totalReleases: 1,
    signedSince: "2024-01-15",
    bio: "GTN-O is the founder of ORBEAT Records, a producer and curator shaping the label's orbital sound — driving basslines, cinematic pads, and late-night energy. His music moves between progressive house and melodic techno, always with a sense of narrative restraint.",
  },
  {
    name: "Martiness",
    label: "ORBEAT Records",
    status: "active",
    genres: ["Melodic Techno", "Progressive House"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/martiness" },
      { platform: "Instagram", url: "https://instagram.com/martiness" },
    ],
    totalReleases: 2,
    signedSince: "2024-03-01",
    bio: "Martiness brings a driving, emotive style to ORBEAT Records. His productions blend hypnotic grooves with melodic peaks, drawing from the darker edges of melodic techno and the rolling energy of progressive house.",
  },
  {
    name: "Roberto Serrano",
    label: "ORBEAT Records",
    status: "active",
    genres: ["Melodic House", "Progressive House", "Afro House"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/robertoserrano" },
      { platform: "Instagram", url: "https://instagram.com/robertoserrano" },
    ],
    totalReleases: 0,
    signedSince: "2024-06-01",
    bio: "Roberto Serrano explores the warmer, groove-oriented side of the label's output. His sound sits at the intersection of melodic house, progressive house, and afro house — rhythmic percussion, soulful motifs, and dancefloor-driven arrangements.",
  },
  {
    name: "GambaTrax",
    label: "ORBEAT Records",
    status: "active",
    genres: ["Melodic Techno", "Progressive", "Afro Tech"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/gambatrax" },
      { platform: "Instagram", url: "https://instagram.com/gambatrax" },
    ],
    totalReleases: 0,
    signedSince: "2024-09-01",
    bio: "GambaTrax rounds out the ORBEAT roster with a hybrid sound that moves between melodic techno, progressive, and afro tech. Tribal percussion meets modern synth work for a distinctive late-night vibe.",
  },
];

const RELEASES = [
  {
    catalogNumber: "ORB001",
    title: "BN1",
    artist: "GTN-O",
    artistId: "", // filled after artist creation
    status: "released",
    priority: "high",
    releaseDate: "2024-06-15",
    genres: ["Progressive House", "Melodic Techno"],
    tracks: [
      { id: "t1", title: "BN1 (Original Mix)", duration: "7:22", bpm: 126, key: "G min", isMastered: true },
      { id: "t2", title: "BN1 (Extended Mix)", duration: "8:15", bpm: 126, key: "G min", isMastered: true },
    ],
    promoAssetsReady: true,
    distributorSubmitted: true,
    needsAttention: false,
    launchChecklist: [
      { id: "lc1", title: "Mastering approved", completed: true, required: true },
      { id: "lc2", title: "Artwork finalized", completed: true, required: true },
      { id: "lc3", title: "Distribution submitted", completed: true, required: true },
      { id: "lc4", title: "Promo assets ready", completed: true, required: false },
    ],
  },
  {
    catalogNumber: "ORB002",
    title: "Out Of Light",
    artist: "Martiness",
    artistId: "",
    status: "released",
    priority: "high",
    releaseDate: "2024-09-20",
    genres: ["Melodic Techno"],
    tracks: [
      { id: "t3", title: "Out Of Light (Original Mix)", duration: "6:55", bpm: 128, key: "D min", isMastered: true },
      { id: "t4", title: "Out Of Light (Ambient Mix)", duration: "5:30", bpm: 120, key: "D min", isMastered: true },
    ],
    promoAssetsReady: true,
    distributorSubmitted: true,
    needsAttention: false,
    launchChecklist: [
      { id: "lc5", title: "Mastering approved", completed: true, required: true },
      { id: "lc6", title: "Artwork finalized", completed: true, required: true },
      { id: "lc7", title: "Distribution submitted", completed: true, required: true },
      { id: "lc8", title: "Video teaser", completed: true, required: false },
    ],
  },
  {
    catalogNumber: "ORB003",
    title: "Love",
    artist: "Martiness",
    artistId: "",
    status: "released",
    priority: "medium",
    releaseDate: "2025-01-10",
    genres: ["Melodic Techno"],
    tracks: [
      { id: "t5", title: "Love (Original Mix)", duration: "7:02", bpm: 124, key: "E min", isMastered: true },
    ],
    promoAssetsReady: true,
    distributorSubmitted: true,
    needsAttention: false,
    launchChecklist: [
      { id: "lc9", title: "Mastering approved", completed: true, required: true },
      { id: "lc10", title: "Artwork finalized", completed: true, required: true },
    ],
  },
  {
    catalogNumber: "ORB004",
    title: "Eclipse",
    artist: "GTN-O",
    artistId: "",
    status: "mastering",
    priority: "high",
    releaseDate: "2025-05-30",
    genres: ["Melodic Techno", "Progressive House"],
    tracks: [
      { id: "t6", title: "Eclipse (Original Mix)", duration: "7:45", bpm: 127, key: "F min", isMastered: false },
      { id: "t7", title: "Eclipse (Dub)", duration: "6:30", bpm: 127, key: "F min", isMastered: true },
    ],
    promoAssetsReady: false,
    distributorSubmitted: false,
    needsAttention: true,
    launchChecklist: [
      { id: "lc11", title: "Mastering approved", completed: false, required: true },
      { id: "lc12", title: "Artwork finalized", completed: true, required: true },
      { id: "lc13", title: "Distribution submitted", completed: false, required: true },
    ],
  },
];

const DEMOS = [
  {
    artistName: "Lunar Tide",
    email: "lunar@example.com",
    instagram: "@lunartide",
    trackTitle: "Depth Charge",
    genre: "Melodic Techno",
    duration: "6:30",
    bpm: 126,
    key: "A min",
    status: "listening",
    rating: 4,
    labelFit: "good",
    notes: "Strong arrangement, clean mix. Needs a slight EQ adjustment on the low end. Potential for ORB00X.",
  },
  {
    artistName: "Velora",
    email: "velora@example.com",
    instagram: "@veloramusic",
    trackTitle: "Fading Light",
    genre: "Progressive House",
    duration: "7:12",
    bpm: 122,
    key: "C maj",
    status: "new",
    rating: null,
    labelFit: null,
    notes: "Just received. First impression is promising — good atmosphere, needs full review.",
  },
  {
    artistName: "Nexus Wave",
    email: "nexus@example.com",
    instagram: "@nexuswave",
    trackTitle: "Pulse Drift",
    genre: "Melodic Techno",
    duration: "8:05",
    bpm: 128,
    key: "D maj",
    status: "interested",
    rating: 4,
    labelFit: "perfect",
    notes: "Excellent production. Captures the ORBEAT sound perfectly. Schedule a call.",
  },
  {
    artistName: "Synth Flux",
    email: "synth@example.com",
    instagram: "@synthflux",
    trackTitle: "Neon Rain",
    genre: "Afro House",
    duration: "5:45",
    bpm: 120,
    key: "G min",
    status: "rejected",
    rating: 2,
    labelFit: "poor",
    notes: "Well produced but doesn't fit our current direction. Too commercial for the roster.",
  },
  {
    artistName: "Echo Valley",
    email: "echo@example.com",
    instagram: "@echovalley",
    trackTitle: "Late Night Signal",
    genre: "Progressive House",
    duration: "6:50",
    bpm: 124,
    key: "E min",
    status: "new",
    rating: null,
    labelFit: null,
    notes: "Just arrived. Has the right energy — needs proper evaluation next week.",
  },
];

const CONTRACTS = [
  {
    artist: "GTN-O",
    artistId: "",
    type: "exclusive",
    status: "signed",
    priority: "high",
    signedDate: "2024-01-20",
    expiryDate: "2027-01-20",
    revenueShare: 50,
    value: 5000,
    rights: "100% master rights with label license for 3 years. 50/50 net revenue split after distro fees.",
    gdprStatus: "compliant",
    ipiStatus: "registered",
    notes: "Founder agreement — GTN-O retains full creative control.",
  },
  {
    artist: "Martiness",
    artistId: "",
    type: "exclusive",
    status: "signed",
    priority: "high",
    signedDate: "2024-03-10",
    expiryDate: "2027-03-10",
    revenueShare: 55,
    value: 3000,
    rights: "2-album exclusive deal. 55/45 split in artist's favor. Digital + limited vinyl.",
    gdprStatus: "compliant",
    ipiStatus: "registered",
    notes: "Multi-release deal. ORB002 and ORB003 delivered, ORB004 planned.",
  },
  {
    artist: "Roberto Serrano",
    artistId: "",
    type: "distribution",
    status: "draft",
    priority: "medium",
    signedDate: null,
    expiryDate: null,
    revenueShare: 60,
    value: 0,
    rights: "Digital distribution only. 60/40 split. First release TBD.",
    gdprStatus: "pending",
    ipiStatus: "not_submitted",
    notes: "Contract needs review before signing. First release materials expected soon.",
  },
];

const TASKS = [
  { title: "Approve ORB004 mastering", description: "Listen to the final master of 'Eclipse' and sign off.", status: "in_progress", priority: "high", category: "mastering", dueDate: "2025-06-10", assignee: "admin", relatedToType: "release", relatedToTitle: "ORB004 — Eclipse" },
  { title: "Schedule ORB004 artwork", description: "Brief the designer for the Eclipse artwork.", status: "todo", priority: "medium", category: "artwork", dueDate: "2025-06-05", assignee: "admin", relatedToType: "release", relatedToTitle: "ORB004 — Eclipse" },
  { title: "Follow up with Nexus Wave", description: "Schedule a call with Nexus Wave about their demo 'Pulse Drift'.", status: "todo", priority: "high", category: "admin", dueDate: "2025-06-15", assignee: "admin", relatedToType: null },
  { title: "Review Velora demo", description: "Full listen and assessment of Velora's 'Fading Light'.", status: "backlog", priority: "medium", category: "admin", dueDate: "2025-06-20", assignee: "admin", relatedToType: null },
  { title: "Sign Roberto Serrano contract", description: "Final review and signature of the distribution contract.", status: "todo", priority: "medium", category: "contract", dueDate: "2025-06-25", assignee: "admin", relatedToType: "contract", relatedToTitle: "Roberto Serrano — Distribution" },
  { title: "Submit ORB004 to distributor", description: "Upload final masters + metadata to distributor.", status: "backlog", priority: "high", category: "distributor", dueDate: "2025-06-30", assignee: "admin", relatedToType: "release", relatedToTitle: "ORB004 — Eclipse" },
  { title: "Post ORB003 promo content", description: "Schedule Instagram posts for Love (Martiness).", status: "done", priority: "medium", category: "promo", dueDate: "2025-01-05", assignee: "admin" },
];

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Seeding ORBEAT Records data via ${API_BASE}\n`);

  // 1. Get auth token
  console.log("🔑 Logging in...");
  const loginRes = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!loginRes || !loginRes.token) {
    console.error("  ✗ Login failed. Check credentials.");
    process.exit(1);
  }
  const token = loginRes.token;
  console.log("  ✓ Token obtained\n");

  // 2. Create artists
  console.log("🎤 Creating artists...");
  const artistMap = {}; // name -> id
  for (const a of ARTISTS) {
    const res = await authPost("/api/artists", token, a);
    if (res && res.artist) {
      artistMap[a.name] = res.artist.id;
      console.log(`  ✓ ${a.name} → ${res.artist.id.slice(0, 12)}...`);
    }
    await sleep(200);
  }

  // 3. Create releases
  console.log("\n💿 Creating releases...");
  const releaseMap = {}; // catalogNumber -> id
  for (const r of RELEASES) {
    r.artistId = artistMap[r.artist] || "";
    const res = await authPost("/api/releases", token, r);
    if (res && res.release) {
      releaseMap[r.catalogNumber] = res.release.id;
      console.log(`  ✓ ${r.catalogNumber} — ${r.title} (${r.artist})`);
    }
    await sleep(200);
  }

  // 4. Create demos
  console.log("\n📥 Creating demo submissions...");
  for (const d of DEMOS) {
    const res = await authPost("/api/demos", token, d);
    if (res && res.demo) {
      console.log(`  ✓ ${d.artistName} — "${d.trackTitle}"`);
    }
    await sleep(200);
  }

  // 5. Create contracts
  console.log("\n📝 Creating contracts...");
  for (const c of CONTRACTS) {
    c.artistId = artistMap[c.artist] || "";
    const res = await authPost("/api/contracts", token, c);
    if (res && res.contract) {
      console.log(`  ✓ ${c.artist} — ${c.type} (${c.status})`);
    }
    await sleep(200);
  }

  // 6. Create tasks
  console.log("\n✅ Creating tasks...");
  for (const t of TASKS) {
    const res = await authPost("/api/tasks", token, t);
    if (res && res.task) {
      console.log(`  ✓ ${t.title.slice(0, 50)}`);
    }
    await sleep(200);
  }

  // 7. Create a promo campaign for ORB003
  if (releaseMap["ORB003"]) {
    console.log("\n📢 Creating promo campaign...");
    const campaign = {
      name: "Love — Release Campaign",
      releaseId: releaseMap["ORB003"],
      releaseTitle: "Love",
      artist: "Martiness",
      status: "completed",
      priority: "medium",
      startDate: "2024-12-15",
      endDate: "2025-02-01",
      platforms: ["Spotify", "Beatport", "Instagram", "SoundCloud"],
      budget: 500,
      impressions: 15000,
      engagements: 2300,
      promoPoolStatus: "done",
      djFeedbackStatus: "done",
      instagramContentStatus: "done",
      spotifyPitchStatus: "done",
      beatportFeaturePitchStatus: "done",
      campaignChecklist: [
        { id: "cc1", title: "Spotify pitch submitted", status: "done", required: true },
        { id: "cc2", title: "Instagram teaser posted", status: "done", required: true },
        { id: "cc3", title: "DJ promo pool sent", status: "done", required: true },
        { id: "cc4", title: "Beatport feature pitch", status: "done", required: false },
      ],
      readinessPercentage: 100,
    };
    const res = await authPost("/api/campaigns", token, campaign);
    if (res && res.campaign) {
      console.log(`  ✓ Love — Release Campaign`);
    }
  }

  // 8. Campaign for ORB004 (active)
  if (releaseMap["ORB004"]) {
    console.log("\n📢 Creating active campaign for ORB004...");
    const campaign = {
      name: "Eclipse — Pre-Release Campaign",
      releaseId: releaseMap["ORB004"],
      releaseTitle: "Eclipse",
      artist: "GTN-O",
      status: "active",
      priority: "high",
      startDate: "2025-05-01",
      endDate: "2025-07-15",
      platforms: ["Spotify", "Beatport", "Instagram", "SoundCloud", "YouTube"],
      budget: 1200,
      impressions: 0,
      engagements: 0,
      promoPoolStatus: "in_progress",
      djFeedbackStatus: "not_started",
      instagramContentStatus: "not_started",
      spotifyPitchStatus: "not_started",
      beatportFeaturePitchStatus: "not_started",
      campaignChecklist: [
        { id: "cc5", title: "Final master approved", status: "in_progress", required: true },
        { id: "cc6", title: "Artwork finalized", status: "done", required: true },
        { id: "cc7", title: "Spotify pitch ready", status: "not_started", required: true },
        { id: "cc8", title: "DJ promo pool", status: "not_started", required: true },
      ],
      readinessPercentage: 25,
    };
    const res = await authPost("/api/campaigns", token, campaign);
    if (res && res.campaign) {
      console.log(`  ✓ Eclipse — Pre-Release Campaign`);
    }
  }

  console.log("\n✨ Seed complete!\n");
  console.log(`   ${ARTISTS.length} artists`);
  console.log(`   ${RELEASES.length} releases`);
  console.log(`   ${DEMOS.length} demo submissions`);
  console.log(`   ${CONTRACTS.length} contracts`);
  console.log(`   ${TASKS.length} tasks`);
  console.log(`   2 promo campaigns`);
  console.log(`\n📊 Visit ${API_BASE} to see your data.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
