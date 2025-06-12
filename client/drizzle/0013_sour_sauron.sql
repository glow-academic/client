ALTER TABLE "verification_token" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_token" ALTER COLUMN "expires" SET DEFAULT now();