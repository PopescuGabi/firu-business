CREATE TABLE "calendar_links" (
	"key" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"event_id" text NOT NULL,
	"written" jsonb NOT NULL,
	"remote_updated" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
