CREATE TABLE "client_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"target_type" text,
	"target_id" integer,
	"note" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_feedback_client_idx" ON "client_feedback" USING btree ("client_id");