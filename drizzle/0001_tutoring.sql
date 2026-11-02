CREATE TABLE "tutoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"weekday" integer NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL,
	"every_weeks" integer DEFAULT 1 NOT NULL,
	"start_date" text NOT NULL,
	"gcal_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
