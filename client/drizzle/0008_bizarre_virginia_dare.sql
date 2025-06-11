ALTER TABLE "scenarios" ADD COLUMN "documents" uuid[] DEFAULT '{"RAY"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" DROP COLUMN "documents";