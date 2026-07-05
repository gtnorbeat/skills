CREATE TABLE "nexus_agent_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nexus_agent_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" integer,
	"type" varchar(50) NOT NULL,
	"plan_json" jsonb,
	"execution_log" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_agents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nexus_agents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"system_prompt" text,
	"tools_enabled" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_conversations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nexus_conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"summary" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nexus_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"r2_key" varchar(1024) NOT NULL,
	"type" varchar(50) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_memory" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nexus_memory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nexus_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nexus_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "nexus_agent_runs" ADD CONSTRAINT "nexus_agent_runs_conversation_id_nexus_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."nexus_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_conversations" ADD CONSTRAINT "nexus_conversations_user_id_nexus_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nexus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_files" ADD CONSTRAINT "nexus_files_user_id_nexus_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nexus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_memory" ADD CONSTRAINT "nexus_memory_user_id_nexus_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nexus_users"("id") ON DELETE no action ON UPDATE no action;