ALTER TABLE "simulation_messages" ADD COLUMN "audio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_messages" ADD COLUMN "file_path" text;