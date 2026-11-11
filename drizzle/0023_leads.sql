CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"business" text NOT NULL,
	"niche" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"demo_url" text,
	"notes" text DEFAULT '' NOT NULL,
	"found_on" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_user_idx" ON "leads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_user_business_idx" ON "leads" USING btree ("user_id","business");--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
