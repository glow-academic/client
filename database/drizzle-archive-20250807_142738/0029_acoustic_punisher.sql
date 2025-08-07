ALTER TABLE "profiles" ADD COLUMN "active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "last_active" timestamp with time zone DEFAULT now() NOT NULL;