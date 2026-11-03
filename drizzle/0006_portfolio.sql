CREATE TABLE "portfolio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"client_id" integer,
	"date" text,
	"type" text DEFAULT 'other' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_file_id" text,
	"public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;