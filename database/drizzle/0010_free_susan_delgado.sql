ALTER TABLE "personas" ADD COLUMN "image_input_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "req_per_day" integer;