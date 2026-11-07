ALTER TABLE "clients" ADD COLUMN "tabs" jsonb;--> statement-breakpoint
ALTER TABLE "custom_pages" ADD COLUMN "client_id" integer;--> statement-breakpoint
ALTER TABLE "custom_pages" ADD CONSTRAINT "custom_pages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;