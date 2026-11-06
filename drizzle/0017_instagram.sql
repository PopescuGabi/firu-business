CREATE TABLE "ig_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"date" text NOT NULL,
	"followers" integer,
	"reach" integer,
	"views" integer,
	"interactions" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"saves" integer,
	"follows" integer,
	"unfollows" integer,
	"profile_link_taps" integer
);
--> statement-breakpoint
CREATE TABLE "ig_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"media_id" text NOT NULL,
	"kind" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"permalink" text DEFAULT '' NOT NULL,
	"thumbnail" text,
	"posted_at" timestamp with time zone NOT NULL,
	"metrics" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" integer,
	"ig_user_id" text NOT NULL,
	"app_user_id" text,
	"username" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"picture" text,
	"account_type" text DEFAULT '' NOT NULL,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ig_daily" ADD CONSTRAINT "ig_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_daily" ADD CONSTRAINT "ig_daily_account_id_instagram_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."instagram_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_media" ADD CONSTRAINT "ig_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_media" ADD CONSTRAINT "ig_media_account_id_instagram_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."instagram_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_accounts" ADD CONSTRAINT "instagram_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_accounts" ADD CONSTRAINT "instagram_accounts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ig_daily_one" ON "ig_daily" USING btree ("account_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "ig_media_one" ON "ig_media" USING btree ("account_id","media_id");--> statement-breakpoint
CREATE INDEX "ig_media_account" ON "ig_media" USING btree ("user_id","account_id","posted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_accounts_one" ON "instagram_accounts" USING btree ("user_id","ig_user_id");--> statement-breakpoint
ALTER TABLE "instagram_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ig_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ig_daily" ENABLE ROW LEVEL SECURITY;