CREATE TABLE "custom_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"page_id" integer NOT NULL,
	"collection" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"icon" text DEFAULT 'list' NOT NULL,
	"color" text DEFAULT '#0A84FF' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"spec" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_items" ADD CONSTRAINT "custom_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_items" ADD CONSTRAINT "custom_items_page_id_custom_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."custom_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_pages" ADD CONSTRAINT "custom_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_items_page" ON "custom_items" USING btree ("user_id","page_id","collection");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_pages_slug" ON "custom_pages" USING btree ("user_id","slug");--> statement-breakpoint
ALTER TABLE "custom_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custom_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Everyone now uses the owner's Anthropic key; members' own keys are no longer used, so they are removed.
UPDATE "users" SET "anthropic_key" = NULL WHERE "role" <> 'owner';