CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"proposal" jsonb,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"version" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"date" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carousels" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"theme" jsonb NOT NULL,
	"post_date" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#007AFF' NOT NULL,
	"app_name" text DEFAULT '' NOT NULL,
	"drive_folder_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_account" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"root_folder_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_days" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_min" integer DEFAULT 75 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"task_id" integer,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"gcal_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'reel' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reels" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"hook" text DEFAULT '' NOT NULL,
	"script" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"post_date" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_classes" (
	"weekday" integer NOT NULL,
	"period" integer NOT NULL,
	"subject" text NOT NULL,
	CONSTRAINT "school_classes_weekday_period_pk" PRIMARY KEY("weekday","period")
);
--> statement-breakpoint
CREATE TABLE "school_days" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"start_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"client_id" integer,
	"due" text,
	"estimate_min" integer DEFAULT 30 NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_updates" ADD CONSTRAINT "app_updates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carousels" ADD CONSTRAINT "carousels_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_messages_target_idx" ON "ai_messages" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "app_updates_client_idx" ON "app_updates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "carousels_client_idx" ON "carousels" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "plan_blocks_date_idx" ON "plan_blocks" USING btree ("date");--> statement-breakpoint
CREATE INDEX "reels_client_idx" ON "reels" USING btree ("client_id");