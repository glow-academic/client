ALTER TABLE "profiles" ALTER COLUMN "role" SET DEFAULT 'guest';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "default_profile" boolean DEFAULT false NOT NULL;