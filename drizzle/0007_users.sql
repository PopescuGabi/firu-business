-- Multi-user: everyone's rows carry user_id. Existing rows belong to the owner (user 1),
-- whose email seed() fills in from ALLOWED_EMAIL.
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"role" text DEFAULT 'member' NOT NULL,
	"modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"onboarded" boolean DEFAULT false NOT NULL,
	"anthropic_key" text,
	"share_token" text,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_share_token_unique" UNIQUE("share_token")
);--> statement-breakpoint
CREATE TABLE "invites" (
	"email" text PRIMARY KEY NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);--> statement-breakpoint
INSERT INTO "users" ("id", "email", "role", "onboarded") VALUES (1, '', 'owner', true);--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('users', 'id'), 1);--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_messages" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_updates" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_updates" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "calendar_links" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_links" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "carousels" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "carousels" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "client_feedback" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "gym_days" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "gym_days" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_blocks" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_items" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "prompts" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reels" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "school_classes" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "school_classes" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "school_days" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "school_days" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tutoring" ADD COLUMN "user_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tutoring" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
ALTER TABLE "school_days" DROP CONSTRAINT "school_days_pkey";--> statement-breakpoint
ALTER TABLE "gym_days" DROP CONSTRAINT "gym_days_pkey";--> statement-breakpoint
ALTER TABLE "calendar_links" DROP CONSTRAINT "calendar_links_pkey";--> statement-breakpoint
ALTER TABLE "school_classes" DROP CONSTRAINT "school_classes_weekday_period_pk";--> statement-breakpoint
ALTER TABLE "calendar_links" ADD CONSTRAINT "calendar_links_user_id_key_pk" PRIMARY KEY("user_id","key");--> statement-breakpoint
ALTER TABLE "gym_days" ADD CONSTRAINT "gym_days_user_id_weekday_pk" PRIMARY KEY("user_id","weekday");--> statement-breakpoint
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_user_id_weekday_period_pk" PRIMARY KEY("user_id","weekday","period");--> statement-breakpoint
ALTER TABLE "school_days" ADD CONSTRAINT "school_days_user_id_weekday_pk" PRIMARY KEY("user_id","weekday");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_key_pk" PRIMARY KEY("user_id","key");--> statement-breakpoint
ALTER TABLE "google_account" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "google_account" ADD CONSTRAINT "google_account_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_updates" ADD CONSTRAINT "app_updates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_links" ADD CONSTRAINT "calendar_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carousels" ADD CONSTRAINT "carousels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_days" ADD CONSTRAINT "gym_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_days" ADD CONSTRAINT "school_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring" ADD CONSTRAINT "tutoring_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "plan_blocks_date_idx";--> statement-breakpoint
CREATE INDEX "plan_blocks_date_idx" ON "plan_blocks" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "clients_user_idx" ON "clients" USING btree ("user_id");
