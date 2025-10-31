-- Fix file_path mismatches for UUID-based documents
UPDATE documents 
SET file_path = '57d963bc-f6f9-4fd4-b7b5-cdb822f4778.pdf'
WHERE id = '57d963bc-f6f9-4fd4-b7b5-cdb822f4778a';
--> statement-breakpoint
UPDATE documents 
SET file_path = 'edfab767-8ff1-4418-ad8f-22cec348b76.pdf'
WHERE id = 'edfab767-8ff1-4418-ad8f-22cec348b76c';
--> statement-breakpoint
-- Add image_model column to models table
ALTER TABLE "models" ADD COLUMN "image_model" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill all existing models to true
UPDATE "models" SET "image_model" = true;
--> statement-breakpoint
-- Backfill profile_activity table before dropping last_active
INSERT INTO "profile_activity" ("profile_id", "last_active", "created_at")
SELECT id, last_active, created_at
FROM profiles
WHERE NOT EXISTS (
    SELECT 1 FROM profile_activity pa WHERE pa.profile_id = profiles.id
);
--> statement-breakpoint
-- Remove file_id column from documents table
ALTER TABLE "documents" DROP COLUMN "file_id";
--> statement-breakpoint
-- Drop last_active column from profiles table
ALTER TABLE "profiles" DROP COLUMN "last_active";

