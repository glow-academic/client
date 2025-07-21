CREATE TABLE "scenario_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "locations" CASCADE;--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_location_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."scenario_locations"("id") ON DELETE set null ON UPDATE no action;