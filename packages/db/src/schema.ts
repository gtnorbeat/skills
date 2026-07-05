import {
  pgTable,
  integer,
  text,
  varchar,
  jsonb,
  timestamp,
  boolean,
  real,
  index,
} from "drizzle-orm/pg-core";

// ---- Users ----
export const users = pgTable("nexus_users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Conversations ----
export const conversations = pgTable("nexus_conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  summary: text("summary"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Agents (registered agent configs) ----
export const agents = pgTable("nexus_agents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  systemPrompt: text("system_prompt"),
  toolsEnabled: jsonb("tools_enabled").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Agent Runs (execution traces) ----
export const agentRuns = pgTable("nexus_agent_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  type: varchar("type", { length: 50 }).notNull(), // "simple" | "medium" | "complex"
  planJson: jsonb("plan_json"),
  executionLog: jsonb("execution_log"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // "pending" | "running" | "completed" | "failed"
  durationMs: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Files (R2 object references) ----
export const files = pgTable("nexus_files", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  r2Key: varchar("r2_key", { length: 1024 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // "image" | "audio" | "log" | "dataset" | "embedding"
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Memory (vector-capable context store) ----
export const memory = pgTable("nexus_memory", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  text: text("text").notNull(),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// AURALABELS — Label Manager tables (auralabels_ prefix)
// ═══════════════════════════════════════════════════════════════════

// ---- Auralabels Users (label manager auth, separate from nexus_users) ----
export const auralabelsUsers = pgTable("auralabels_users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  tenantId: text("tenant_id"),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- Demos ----
export const auralabelsDemos = pgTable("auralabels_demos", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  artistName: text("artist_name").notNull().default(""),
  email: text("email").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  trackTitle: text("track_title").notNull().default(""),
  genre: text("genre").notNull().default(""),
  duration: text("duration").notNull().default(""),
  bpm: integer("bpm").notNull().default(0),
  key: text("key").notNull().default(""),
  receivedDate: text("received_date").notNull().default(""),
  status: text("status").notNull().default("new"),
  rating: integer("rating"),
  labelFit: text("label_fit"),
  privateLink: text("private_link").notNull().default(""),
  audioUrl: text("audio_url").notNull().default(""),
  notes: text("notes").notNull().default(""),
  nextAction: text("next_action").default(""),
});

// ---- Artists ----
export const auralabelsArtists = pgTable("auralabels_artists", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull().default(""),
  label: text("label").notNull().default(""),
  status: text("status").notNull().default("active"),
  imageUrl: text("image_url").notNull().default(""),
  genres: jsonb("genres").notNull().default([]),
  socialLinks: jsonb("social_links").notNull().default([]),
  totalReleases: integer("total_releases").notNull().default(0),
  signedSince: text("signed_since").notNull().default(""),
  bio: text("bio").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- Releases ----
export const auralabelsReleases = pgTable("auralabels_releases", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  catalogNumber: text("catalog_number").notNull().default(""),
  title: text("title").notNull().default(""),
  artist: text("artist").notNull().default(""),
  artistId: text("artist_id").notNull().default(""),
  status: text("status").notNull().default("draft"),
  priority: text("priority").notNull().default("medium"),
  releaseDate: text("release_date").notNull().default(""),
  tracks: jsonb("tracks").notNull().default([]),
  artworkUrl: text("artwork_url").notNull().default(""),
  genres: jsonb("genres").notNull().default([]),
  launchChecklist: jsonb("launch_checklist").notNull().default([]),
  readinessPercentage: integer("readiness_percentage").notNull().default(0),
  promoAssetsReady: boolean("promo_assets_ready").notNull().default(false),
  distributorSubmitted: boolean("distributor_submitted").notNull().default(false),
  needsAttention: boolean("needs_attention").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- Contracts ----
export const auralabelsContracts = pgTable("auralabels_contracts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  artist: text("artist").notNull().default(""),
  artistId: text("artist_id").notNull().default(""),
  type: text("type").notNull().default("exclusive"),
  status: text("status").notNull().default("draft"),
  priority: text("priority").notNull().default("medium"),
  signedDate: text("signed_date"),
  expiryDate: text("expiry_date"),
  revenueShare: integer("revenue_share").notNull().default(50),
  value: real("value").notNull().default(0),
  rights: text("rights").notNull().default(""),
  gdprStatus: text("gdpr_status").notNull().default("pending"),
  ipiStatus: text("ipi_status").notNull().default("pending"),
  fileUrl: text("file_url"),
  nextAction: text("next_action"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- Tasks ----
export const auralabelsTasks = pgTable("auralabels_tasks", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  category: text("category").notNull().default("admin"),
  dueDate: text("due_date").notNull().default(""),
  assignee: text("assignee").notNull().default(""),
  relatedToType: text("related_to_type"),
  relatedToId: text("related_to_id"),
  relatedToTitle: text("related_to_title"),
  overdue: boolean("overdue").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- Campaigns ----
export const auralabelsCampaigns = pgTable("auralabels_campaigns", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull().default(""),
  releaseId: text("release_id").notNull().default(""),
  releaseTitle: text("release_title").notNull().default(""),
  artist: text("artist").notNull().default(""),
  status: text("status").notNull().default("planning"),
  priority: text("priority").notNull().default("medium"),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  platforms: jsonb("platforms").notNull().default([]),
  budget: real("budget").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  engagements: integer("engagements").notNull().default(0),
  promoPoolStatus: text("promo_pool_status").notNull().default("not_started"),
  djFeedbackStatus: text("dj_feedback_status").notNull().default("not_started"),
  instagramContentStatus: text("instagram_content_status").notNull().default("not_started"),
  youtubeTeaserStatus: text("youtube_teaser_status").notNull().default("not_started"),
  beatportFeaturePitchStatus: text("beatport_feature_pitch_status").notNull().default("not_started"),
  spotifyPitchStatus: text("spotify_pitch_status").notNull().default("not_started"),
  emailBlastStatus: text("email_blast_status").notNull().default("not_started"),
  campaignChecklist: jsonb("campaign_checklist").notNull().default([]),
  readinessPercentage: integer("readiness_percentage").notNull().default(0),
  missingContent: jsonb("missing_content").notNull().default([]),
  nextAction: text("next_action").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- AI Actions ----
export const auralabelsAiActions = pgTable("auralabels_ai_actions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  action: text("action").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("analysis"),
  priority: text("priority").notNull().default("medium"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  used: boolean("used").notNull().default(false),
});

// ---- Activities ----
export const auralabelsActivities = pgTable("auralabels_activities", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  artistId: text("artist_id").notNull().default(""),
  artistName: text("artist_name").notNull().default(""),
  action: text("action").notNull().default(""),
  timestamp: text("timestamp").notNull().default(""),
  type: text("type").notNull().default("note"),
});

// ---- Revenue ----
export const auralabelsRevenue = pgTable("auralabels_revenue", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  totalRevenue: real("total_revenue").notNull().default(0),
  monthlyRevenue: real("monthly_revenue").notNull().default(0),
  pendingPayouts: real("pending_payouts").notNull().default(0),
  currency: text("currency").notNull().default("EUR"),
  revenueByArtist: jsonb("revenue_by_artist").notNull().default([]),
  revenueByRelease: jsonb("revenue_by_release").notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- Beta Applications ----
export const auralabelsBetaApplications = pgTable("auralabels_beta_applications", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  label: text("label").notNull().default(""),
  role: text("role").notNull().default("Not specified"),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ([
  index("idx_auralabels_beta_status").on(table.status, table.createdAt.desc()),
]));
