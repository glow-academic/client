CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"department_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"profile_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"department_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_of_day" time NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topics" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "events" CASCADE;--> statement-breakpoint
DROP TABLE "schedules" CASCADE;--> statement-breakpoint
DROP TABLE "topics" CASCADE;--> statement-breakpoint
ALTER TABLE "scenarios" RENAME COLUMN "documents" TO "document_ids";--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "department_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "profile_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "deadline_id" uuid;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "time_id" uuid;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "practice_scenario" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "public"."scenario_deadlines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_time_id_fkey" FOREIGN KEY ("time_id") REFERENCES "public"."scenario_times"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."scenarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "class_ids";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "seniority";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "location";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "tod";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "urgency";--> statement-breakpoint
DROP TYPE "public"."locations";--> statement-breakpoint
DROP TYPE "public"."seniority_levels";--> statement-breakpoint
DROP TYPE "public"."time_of_day";--> statement-breakpoint
DROP TYPE "public"."urgency_type";