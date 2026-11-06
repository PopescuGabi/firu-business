DROP TABLE "gym_days" CASCADE;--> statement-breakpoint
DROP TABLE "gym_sets" CASCADE;--> statement-breakpoint
DROP TABLE "school_classes" CASCADE;--> statement-breakpoint
DROP TABLE "school_days" CASCADE;--> statement-breakpoint
DROP TABLE "tutoring" CASCADE;--> statement-breakpoint
-- School, gym and tutoring are gone from the app: remove what was stored for them (decided by the owner, irreversible).
DELETE FROM "ai_messages" WHERE "target_type" = 'gym';--> statement-breakpoint
DELETE FROM "plan_blocks" WHERE "kind" IN ('gym', 'study');--> statement-breakpoint
DELETE FROM "settings" WHERE "key" IN ('classMinutes', 'breakMinutes', 'freeDayStart', 'schoolYearEnd', 'gymExtraMinutes');--> statement-breakpoint
DELETE FROM "places" WHERE "name" IN ('gym', 'school');--> statement-breakpoint
UPDATE "settings" SET "value" = COALESCE(
  (SELECT jsonb_object_agg(k, v) FROM jsonb_each("value") AS t(k, v) WHERE split_part(k, '>', 1) NOT IN ('gym', 'school') AND split_part(k, '>', 2) NOT IN ('gym', 'school')),
  '{}'::jsonb
) WHERE "key" = 'travel' AND jsonb_typeof("value") = 'object';--> statement-breakpoint
UPDATE "users" SET "modules" = COALESCE(
  (SELECT jsonb_agg(m) FROM jsonb_array_elements("modules") AS m WHERE m #>> '{}' NOT IN ('school', 'gym', 'prompts')),
  '[]'::jsonb
);
