CREATE TABLE "scenario_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"class_code" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "departments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "classes" CASCADE;--> statement-breakpoint
DROP TABLE "departments" CASCADE;--> statement-breakpoint
ALTER TABLE "cohorts" DROP CONSTRAINT "cohorts_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_class_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_class_id_fkey";
--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "simulation_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."scenario_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "class_id";--> statement-breakpoint
ALTER TABLE "simulations" DROP COLUMN "cohort_ids";--> statement-breakpoint
DROP TYPE "public"."class_term";