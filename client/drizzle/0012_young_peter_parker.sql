ALTER TABLE "verification_token" ALTER COLUMN "expires" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification_token" ALTER COLUMN "expires" DROP NOT NULL;