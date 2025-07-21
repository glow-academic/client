ALTER TABLE "documents" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "active" boolean DEFAULT true NOT NULL;