CREATE TABLE "gym_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"exercise" text NOT NULL,
	"set_no" integer NOT NULL,
	"weight" real DEFAULT 0 NOT NULL,
	"reps" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gym_sets" ADD CONSTRAINT "gym_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gym_sets_one" ON "gym_sets" USING btree ("user_id","date","exercise","set_no");--> statement-breakpoint
CREATE INDEX "gym_sets_exercise" ON "gym_sets" USING btree ("user_id","exercise","date");--> statement-breakpoint
ALTER TABLE "gym_sets" ENABLE ROW LEVEL SECURITY;
