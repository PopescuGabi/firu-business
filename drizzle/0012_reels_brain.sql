ALTER TABLE "clients" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "plan" jsonb DEFAULT '{}'::jsonb NOT NULL;