#!/usr/bin/env node
/**
 * Seed the local database with realistic ORBEAT Records demo data.
 *
 * Unlike seed-demo.mjs (which hits the HTTP API), this script connects
 * directly to Neon Postgres using the Drizzle ORM. No server needed.
 *
 * Prerequisites:
 *   cd packages/db && npm run build   # build the shared schema package
 *
 * Usage:
 *   export DATABASE_URL="postgresql://..."
 *   node scripts/seed-local.mjs
 *
 * Or via npm:
 *   npm run seed
 *
 * Idempotent — clears all auralabels tables before inserting so you
 * can run it repeatedly and always get a clean state.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@aura-labels/db/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Export it and try again.");
  process.exit(1);
}

console.log("🔌 Connecting to Neon...");
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

// Verify connectivity before touching data.
await sql`SELECT 1`;
console.log("  ✓ Connected");

// ── Helpers ──────────────────────────────────────────────────────────

const uid = () => randomUUID();

/** Truncate all auralabels tables in dependency order. */
async function clearAll() {
  const tables = [
    schema.auralabelsActivities,
    schema.auralabelsAiActions,
    schema.auralabelsCampaigns,
    schema.auralabelsTasks,
    schema.auralabelsContracts,
    schema.auralabelsReleases,
    schema.auralabelsDemos,
    schema.auralabelsArtists,
    schema.auralabelsRevenue,
    schema.auralabelsBetaApplications,
    schema.auralabelsUsers,
  ];
  for (const t of tables) {
    await db.delete(t);
  }
  console.log("  ✓ Cleared existing data");
}

// ── Data ─────────────────────────────────────────────────────────────

const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AuraAdmin2026!";

const ARTISTS = [
  {
    name: "GTN-O", label: "ORBEAT Records", status: "active",
    genres: ["Progressive House", "Melodic Techno"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/gtno" },
      { platform: "Instagram", url: "https://instagram.com/gtno" },
      { platform: "Spotify", url: "https://open.spotify.com/artist/gtno" },
    ],
    totalReleases: 2,
    signedSince: "2024-01-15",
    bio: "GTN-O is the founder of ORBEAT Records, a producer and curator shaping the label's orbital sound — driving basslines, cinematic pads, and late-night energy.",
  },
  {
    name: "Martiness", label: "ORBEAT Records", status: "active",
    genres: ["Melodic Techno", "Progressive House"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/martiness" },
      { platform: "Instagram", url: "https://instagram.com/martiness" },
    ],
    totalReleases: 2,
    signedSince: "2024-03-01",
    bio: "Martiness brings a driving, emotive style — hypnotic grooves with melodic peaks, drawing from the darker edges of melodic techno.",
  },
  {
    name: "Roberto Serrano", label: "ORBEAT Records", status: "active",
    genres: ["Melodic House", "Progressive House", "Afro House"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/robertoserrano" },
      { platform: "Instagram", url: "https://instagram.com/robertoserrano" },
    ],
    totalReleases: 0,
    signedSince: "2024-06-01",
    bio: "Roberto Serrano explores the warmer, groove-oriented side of the label — rhythmic percussion, soulful motifs, and dancefloor-driven arrangements.",
  },
  {
    name: "GambaTrax", label: "ORBEAT Records", status: "active",
    genres: ["Melodic Techno", "Progressive", "Afro Tech"],
    socialLinks: [
      { platform: "SoundCloud", url: "https://soundcloud.com/gambatrax" },
      { platform: "Instagram", url: "https://instagram.com/gambatrax" },
    ],
    totalReleases: 0,
    signedSince: "2024-09-01",
    bio: "GambaTrax rounds out the ORBEAT roster with a hybrid sound — tribal percussion meets modern synth work for a distinctive late-night vibe.",
  },
];

const DEMOS = [
  {
    artistName: "Lunar Tide", email: "lunar@example.com", instagram: "@lunartide",
    trackTitle: "Depth Charge", genre: "Melodic Techno", duration: "6:30",
    bpm: 126, key: "A min", receivedDate: "2025-03-10", status: "listening",
    rating: 4, labelFit: "good",
    notes: "Strong arrangement, clean mix. Needs slight EQ on the low end. Potential signing candidate.",
    nextAction: "Schedule follow-up call",
  },
  {
    artistName: "Velora", email: "velora@example.com", instagram: "@veloramusic",
    trackTitle: "Fading Light", genre: "Progressive House", duration: "7:12",
    bpm: 122, key: "C maj", receivedDate: "2025-05-20", status: "new",
    rating: null, labelFit: null,
    notes: "Just received — good atmosphere, needs full review.",
    nextAction: null,
  },
  {
    artistName: "Nexus Wave", email: "nexus@example.com", instagram: "@nexuswave",
    trackTitle: "Pulse Drift", genre: "Melodic Techno", duration: "8:05",
    bpm: 128, key: "D maj", receivedDate: "2025-04-01", status: "interested",
    rating: 4, labelFit: "perfect",
    notes: "Excellent production. Captures the ORBEAT sound perfectly.",
    nextAction: "Schedule contract discussion",
  },
  {
    artistName: "Synth Flux", email: "synth@example.com", instagram: "@synthflux",
    trackTitle: "Neon Rain", genre: "Afro House", duration: "5:45",
    bpm: 120, key: "G min", receivedDate: "2025-02-15", status: "rejected",
    rating: 2, labelFit: "poor",
    notes: "Well produced but doesn't fit current direction. Too commercial.",
    nextAction: null,
  },
  {
    artistName: "Echo Valley", email: "echo@example.com", instagram: "@echovalley",
    trackTitle: "Late Night Signal", genre: "Progressive House", duration: "6:50",
    bpm: 124, key: "E min", receivedDate: "2025-06-01", status: "new",
    rating: null, labelFit: null,
    notes: "Has the right energy — needs evaluation.",
    nextAction: null,
  },
];

const CONTRACTS = [
  {
    artist: "GTN-O", type: "exclusive", status: "signed", priority: "high",
    signedDate: "2024-01-20", expiryDate: "2027-01-20",
    revenueShare: 50, value: 5000,
    rights: "100% master rights with label license for 3 years. 50/50 net revenue split.",
    gdprStatus: "compliant", ipiStatus: "registered",
    notes: "Founder agreement — GTN-O retains full creative control.",
  },
  {
    artist: "Martiness", type: "exclusive", status: "signed", priority: "high",
    signedDate: "2024-03-10", expiryDate: "2027-03-10",
    revenueShare: 55, value: 3000,
    rights: "2-album exclusive deal. 55/45 split in artist's favor. Digital + limited vinyl.",
    gdprStatus: "compliant", ipiStatus: "registered",
    notes: "ORB002 and ORB003 delivered, ORB004 planned.",
  },
  {
    artist: "Roberto Serrano", type: "distribution", status: "draft", priority: "medium",
    signedDate: null, expiryDate: null,
    revenueShare: 60, value: 0,
    rights: "Digital distribution only. 60/40 split. First release TBD.",
    gdprStatus: "pending", ipiStatus: "not_submitted",
    notes: "Contract needs review before signing. First release materials expected soon.",
  },
];

const TASKS = [
  { title: "Approve ORB004 mastering", description: "Listen to the final master of 'Eclipse' and sign off.", status: "in_progress", priority: "high", category: "mastering", dueDate: "2025-06-10", assignee: "admin", relatedToType: "release", relatedToTitle: "ORB004 — Eclipse" },
  { title: "Schedule ORB004 artwork", description: "Brief the designer for the Eclipse artwork.", status: "todo", priority: "medium", category: "artwork", dueDate: "2025-06-05", assignee: "admin", relatedToType: "release", relatedToTitle: "ORB004 — Eclipse" },
  { title: "Follow up with Nexus Wave", description: "Schedule a call about their demo 'Pulse Drift'.", status: "todo", priority: "high", category: "admin", dueDate: "2025-06-15", assignee: "admin" },
  { title: "Review Velora demo", description: "Full listen and assessment of Velora's 'Fading Light'.", status: "backlog", priority: "medium", category: "admin", dueDate: "2025-06-20", assignee: "admin" },
  { title: "Sign Roberto Serrano contract", description: "Final review and signature of the distribution contract.", status: "todo", priority: "medium", category: "contract", dueDate: "2025-06-25", assignee: "admin", relatedToType: "contract", relatedToTitle: "Roberto Serrano — Distribution" },
  { title: "Submit ORB004 to distributor", description: "Upload final masters + metadata to distributor.", status: "backlog", priority: "high", category: "distributor", dueDate: "2025-06-30", assignee: "admin", relatedToType: "release", relatedToTitle: "ORB004 — Eclipse" },
  { title: "Post ORB003 promo content", description: "Schedule Instagram posts for Love (Martiness).", status: "done", priority: "medium", category: "promo", dueDate: "2025-01-05", assignee: "admin" },
];

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🎵 Seeding ORBEAT Records demo data\n");

  // 1. Hash admin password
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // 2. Clear existing data
  await clearAll();

  // 3. Create admin user
  console.log("👤 Creating admin user...");
  const adminId = uid();
  await db.insert(schema.auralabelsUsers).values({
    id: adminId,
    username: ADMIN_USERNAME,
    passwordHash,
    role: "admin",
    disabled: false,
  });
  console.log("  ✓ admin");

  // 4. Create artists + map names to IDs
  console.log("\n🎤 Creating artists...");
  const artistMap = /** @type {Record<string, string>} */ ({});
  for (const a of ARTISTS) {
    const id = uid();
    artistMap[a.name] = id;
    await db.insert(schema.auralabelsArtists).values({
      id, name: a.name, label: a.label, status: a.status,
      genres: a.genres, socialLinks: a.socialLinks,
      totalReleases: a.totalReleases, signedSince: a.signedSince,
      bio: a.bio, imageUrl: "",
    });
    console.log(`  ✓ ${a.name}`);
  }

  // 5. Create releases
  console.log("\n💿 Creating releases...");
  const releaseMap = /** @type {Record<string, string>} */ ({});

  const releases = [
    {
      catalogNumber: "ORB001", title: "BN1", artist: "GTN-O",
      status: "released", priority: "high", releaseDate: "2024-06-15",
      genres: ["Progressive House", "Melodic Techno"],
      tracks: [
        { id: "t1", title: "BN1 (Original Mix)", duration: "7:22", bpm: 126, key: "G min", isMastered: true },
        { id: "t2", title: "BN1 (Extended Mix)", duration: "8:15", bpm: 126, key: "G min", isMastered: true },
      ],
      launchChecklist: [
        { id: "lc1", title: "Mastering approved", completed: true, required: true },
        { id: "lc2", title: "Artwork finalized", completed: true, required: true },
        { id: "lc3", title: "Distribution submitted", completed: true, required: true },
        { id: "lc4", title: "Promo assets ready", completed: true, required: false },
      ],
      readinessPercentage: 100, promoAssetsReady: true,
      distributorSubmitted: true, needsAttention: false,
    },
    {
      catalogNumber: "ORB002", title: "Out Of Light", artist: "Martiness",
      status: "released", priority: "high", releaseDate: "2024-09-20",
      genres: ["Melodic Techno"],
      tracks: [
        { id: "t3", title: "Out Of Light (Original Mix)", duration: "6:55", bpm: 128, key: "D min", isMastered: true },
        { id: "t4", title: "Out Of Light (Ambient Mix)", duration: "5:30", bpm: 120, key: "D min", isMastered: true },
      ],
      launchChecklist: [
        { id: "lc5", title: "Mastering approved", completed: true, required: true },
        { id: "lc6", title: "Artwork finalized", completed: true, required: true },
        { id: "lc7", title: "Distribution submitted", completed: true, required: true },
        { id: "lc8", title: "Video teaser", completed: true, required: false },
      ],
      readinessPercentage: 100, promoAssetsReady: true,
      distributorSubmitted: true, needsAttention: false,
    },
    {
      catalogNumber: "ORB003", title: "Love", artist: "Martiness",
      status: "released", priority: "medium", releaseDate: "2025-01-10",
      genres: ["Melodic Techno"],
      tracks: [
        { id: "t5", title: "Love (Original Mix)", duration: "7:02", bpm: 124, key: "E min", isMastered: true },
      ],
      launchChecklist: [
        { id: "lc9", title: "Mastering approved", completed: true, required: true },
        { id: "lc10", title: "Artwork finalized", completed: true, required: true },
      ],
      readinessPercentage: 100, promoAssetsReady: true,
      distributorSubmitted: true, needsAttention: false,
    },
    {
      catalogNumber: "ORB004", title: "Eclipse", artist: "GTN-O",
      status: "mastering", priority: "high", releaseDate: "2025-06-30",
      genres: ["Melodic Techno", "Progressive House"],
      tracks: [
        { id: "t6", title: "Eclipse (Original Mix)", duration: "7:45", bpm: 127, key: "F min", isMastered: false },
        { id: "t7", title: "Eclipse (Dub)", duration: "6:30", bpm: 127, key: "F min", isMastered: true },
      ],
      launchChecklist: [
        { id: "lc11", title: "Mastering approved", completed: false, required: true },
        { id: "lc12", title: "Artwork finalized", completed: true, required: true },
        { id: "lc13", title: "Distribution submitted", completed: false, required: true },
      ],
      readinessPercentage: 35, promoAssetsReady: false,
      distributorSubmitted: false, needsAttention: true,
    },
  ];

  for (const r of releases) {
    const id = uid();
    releaseMap[r.catalogNumber] = id;
    await db.insert(schema.auralabelsReleases).values({
      id, catalogNumber: r.catalogNumber, title: r.title,
      artist: r.artist, artistId: artistMap[r.artist] || "",
      status: r.status, priority: r.priority, releaseDate: r.releaseDate,
      tracks: r.tracks, genres: r.genres, launchChecklist: r.launchChecklist,
      readinessPercentage: r.readinessPercentage,
      promoAssetsReady: r.promoAssetsReady,
      distributorSubmitted: r.distributorSubmitted,
      needsAttention: r.needsAttention,
      artworkUrl: "",
    });
    console.log(`  ✓ ${r.catalogNumber} — ${r.title} (${r.artist})`);
  }

  // 6. Create demos
  console.log("\n📥 Creating demo submissions...");
  for (const d of DEMOS) {
    await db.insert(schema.auralabelsDemos).values({
      id: uid(), artistName: d.artistName, email: d.email,
      instagram: d.instagram, trackTitle: d.trackTitle, genre: d.genre,
      duration: d.duration, bpm: d.bpm, key: d.key,
      receivedDate: d.receivedDate, status: d.status,
      rating: d.rating, labelFit: d.labelFit,
      privateLink: "", audioUrl: "", notes: d.notes,
      nextAction: d.nextAction,
    });
    console.log(`  ✓ ${d.artistName} — "${d.trackTitle}"`);
  }

  // 7. Create contracts
  console.log("\n📝 Creating contracts...");
  for (const c of CONTRACTS) {
    await db.insert(schema.auralabelsContracts).values({
      id: uid(), artist: c.artist, artistId: artistMap[c.artist] || "",
      type: c.type, status: c.status, priority: c.priority,
      signedDate: c.signedDate, expiryDate: c.expiryDate,
      revenueShare: c.revenueShare, value: c.value, rights: c.rights,
      gdprStatus: c.gdprStatus, ipiStatus: c.ipiStatus,
      notes: c.notes, nextAction: null, fileUrl: null,
    });
    console.log(`  ✓ ${c.artist} — ${c.type} (${c.status})`);
  }

  // 8. Create tasks
  console.log("\n✅ Creating tasks...");
  for (const t of TASKS) {
    await db.insert(schema.auralabelsTasks).values({
      id: uid(), title: t.title, description: t.description,
      status: t.status, priority: t.priority, category: t.category,
      dueDate: t.dueDate, assignee: t.assignee,
      relatedToType: t.relatedToType || null,
      relatedToId: null, relatedToTitle: t.relatedToTitle || null,
      overdue: false,
    });
    console.log(`  ✓ ${t.title.slice(0, 50)}`);
  }

  // 9. Create campaigns
  console.log("\n📢 Creating promo campaigns...");
  if (releaseMap["ORB003"]) {
    await db.insert(schema.auralabelsCampaigns).values({
      id: uid(), name: "Love — Release Campaign",
      releaseId: releaseMap["ORB003"], releaseTitle: "Love",
      artist: "Martiness", status: "completed", priority: "medium",
      startDate: "2024-12-15", endDate: "2025-02-01",
      platforms: ["Spotify", "Beatport", "Instagram", "SoundCloud"],
      budget: 500, impressions: 15000, engagements: 2300,
      promoPoolStatus: "done", djFeedbackStatus: "done",
      instagramContentStatus: "done", spotifyPitchStatus: "done",
      beatportFeaturePitchStatus: "done", youtubeTeaserStatus: "not_started",
      emailBlastStatus: "not_started",
      campaignChecklist: [
        { id: "cc1", title: "Spotify pitch submitted", status: "done", required: true },
        { id: "cc2", title: "Instagram teaser posted", status: "done", required: true },
        { id: "cc3", title: "DJ promo pool sent", status: "done", required: true },
      ],
      readinessPercentage: 100, missingContent: [],
      nextAction: "",
    });
    console.log("  ✓ Love — Release Campaign");
  }

  if (releaseMap["ORB004"]) {
    await db.insert(schema.auralabelsCampaigns).values({
      id: uid(), name: "Eclipse — Pre-Release Campaign",
      releaseId: releaseMap["ORB004"], releaseTitle: "Eclipse",
      artist: "GTN-O", status: "active", priority: "high",
      startDate: "2025-05-01", endDate: "2025-07-15",
      platforms: ["Spotify", "Beatport", "Instagram", "SoundCloud", "YouTube"],
      budget: 1200, impressions: 0, engagements: 0,
      promoPoolStatus: "in_progress", djFeedbackStatus: "not_started",
      instagramContentStatus: "not_started", spotifyPitchStatus: "not_started",
      beatportFeaturePitchStatus: "not_started", youtubeTeaserStatus: "not_started",
      emailBlastStatus: "not_started",
      campaignChecklist: [
        { id: "cc4", title: "Final master approved", status: "in_progress", required: true },
        { id: "cc5", title: "Artwork finalized", status: "done", required: true },
        { id: "cc6", title: "Spotify pitch ready", status: "not_started", required: true },
      ],
      readinessPercentage: 25, missingContent: ["Master WAV", "Press photos", "Bio"],
      nextAction: "Complete mastering",
    });
    console.log("  ✓ Eclipse — Pre-Release Campaign");
  }

  // 10. Summary
  console.log("\n✨ Seed complete!\n");
  console.log(`   👤 1 admin user  (username: ${ADMIN_USERNAME} — set via BOOTSTRAP_ADMIN_PASSWORD)`);
  console.log(`   🎤 ${ARTISTS.length} artists`);
  console.log(`   💿 ${releases.length} releases`);
  console.log(`   📥 ${DEMOS.length} demo submissions`);
  console.log(`   📝 ${CONTRACTS.length} contracts`);
  console.log(`   ✅ ${TASKS.length} tasks`);
  console.log("   📢 2 promo campaigns");
  console.log("\n🌐 Start the dev server:");
  console.log("   npm run dev\n");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
