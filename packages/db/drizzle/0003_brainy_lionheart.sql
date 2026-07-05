ALTER TABLE "auralabels_activities" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_ai_actions" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_artists" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_campaigns" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_contracts" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_demos" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_releases" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_revenue" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "auralabels_tasks" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;