CREATE TABLE "parameter_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"value" text NOT NULL,
	"parameter_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"numerical" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenario_classes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scenario_deadlines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scenario_locations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scenario_times" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "scenario_classes" CASCADE;--> statement-breakpoint
DROP TABLE "scenario_deadlines" CASCADE;--> statement-breakpoint
DROP TABLE "scenario_locations" CASCADE;--> statement-breakpoint
DROP TABLE "scenario_times" CASCADE;--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_class_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_location_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_deadline_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_time_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "parameter_item_ids" uuid[];--> statement-breakpoint
ALTER TABLE "parameter_items" ADD CONSTRAINT "parameter_items_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "public"."parameters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "crowdedness";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "intensity";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "class_id";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "location_id";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "deadline_id";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "time_id";