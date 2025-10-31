ALTER TABLE "models" ADD COLUMN "image_model" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "file_id";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "last_active";