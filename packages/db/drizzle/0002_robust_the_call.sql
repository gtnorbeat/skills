CREATE TABLE "auralabels_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"artist_id" text DEFAULT '' NOT NULL,
	"artist_name" text DEFAULT '' NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"timestamp" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'note' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_ai_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'analysis' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_artists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"social_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_releases" integer DEFAULT 0 NOT NULL,
	"signed_since" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_beta_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'Not specified' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"release_id" text DEFAULT '' NOT NULL,
	"release_title" text DEFAULT '' NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget" real DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"engagements" integer DEFAULT 0 NOT NULL,
	"promo_pool_status" text DEFAULT 'not_started' NOT NULL,
	"dj_feedback_status" text DEFAULT 'not_started' NOT NULL,
	"instagram_content_status" text DEFAULT 'not_started' NOT NULL,
	"youtube_teaser_status" text DEFAULT 'not_started' NOT NULL,
	"beatport_feature_pitch_status" text DEFAULT 'not_started' NOT NULL,
	"spotify_pitch_status" text DEFAULT 'not_started' NOT NULL,
	"email_blast_status" text DEFAULT 'not_started' NOT NULL,
	"campaign_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"readiness_percentage" integer DEFAULT 0 NOT NULL,
	"missing_content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_action" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"artist_id" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'exclusive' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"signed_date" text,
	"expiry_date" text,
	"revenue_share" integer DEFAULT 50 NOT NULL,
	"value" real DEFAULT 0 NOT NULL,
	"rights" text DEFAULT '' NOT NULL,
	"gdpr_status" text DEFAULT 'pending' NOT NULL,
	"ipi_status" text DEFAULT 'pending' NOT NULL,
	"file_url" text,
	"next_action" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_demos" (
	"id" text PRIMARY KEY NOT NULL,
	"artist_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"track_title" text DEFAULT '' NOT NULL,
	"genre" text DEFAULT '' NOT NULL,
	"duration" text DEFAULT '' NOT NULL,
	"bpm" integer DEFAULT 0 NOT NULL,
	"key" text DEFAULT '' NOT NULL,
	"received_date" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"rating" integer,
	"label_fit" text,
	"private_link" text DEFAULT '' NOT NULL,
	"audio_url" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"next_action" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "auralabels_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"catalog_number" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"artist_id" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"release_date" text DEFAULT '' NOT NULL,
	"tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"artwork_url" text DEFAULT '' NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"launch_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"readiness_percentage" integer DEFAULT 0 NOT NULL,
	"promo_assets_ready" boolean DEFAULT false NOT NULL,
	"distributor_submitted" boolean DEFAULT false NOT NULL,
	"needs_attention" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_revenue" (
	"id" text PRIMARY KEY NOT NULL,
	"total_revenue" real DEFAULT 0 NOT NULL,
	"monthly_revenue" real DEFAULT 0 NOT NULL,
	"pending_payouts" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"revenue_by_artist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revenue_by_release" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'admin' NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"assignee" text DEFAULT '' NOT NULL,
	"related_to_type" text,
	"related_to_id" text,
	"related_to_title" text,
	"overdue" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auralabels_users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"tenant_id" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auralabels_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX "idx_auralabels_beta_status" ON "auralabels_beta_applications" USING btree ("status","created_at" DESC NULLS LAST);