ALTER TABLE "profiles" ALTER COLUMN "last_active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "last_active" DROP NOT NULL;