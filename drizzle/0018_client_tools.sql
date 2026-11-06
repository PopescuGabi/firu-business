ALTER TABLE "clients" ADD COLUMN "business_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "features" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Existing clients keep what they use: Instagram for everyone, content if they have reels or carousels, app if an app name is set, finance if money is logged.
UPDATE "clients" c SET "features" = '["instagram"]'::jsonb
  || CASE WHEN EXISTS (SELECT 1 FROM "reels" r WHERE r."client_id" = c."id") OR EXISTS (SELECT 1 FROM "carousels" x WHERE x."client_id" = c."id") THEN '["content"]'::jsonb ELSE '[]'::jsonb END
  || CASE WHEN c."app_name" <> '' THEN '["app"]'::jsonb ELSE '[]'::jsonb END
  || CASE WHEN EXISTS (SELECT 1 FROM "money" m WHERE m."client_id" = c."id") THEN '["finance"]'::jsonb ELSE '[]'::jsonb END;
