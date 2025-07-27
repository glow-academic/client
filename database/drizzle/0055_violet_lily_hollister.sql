ALTER TABLE "parameter_items" ADD COLUMN "default_item" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parameters" ADD COLUMN "active" boolean DEFAULT false NOT NULL;