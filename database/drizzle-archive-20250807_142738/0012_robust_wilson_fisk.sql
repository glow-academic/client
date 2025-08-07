CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"api_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "default_agent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "default_class" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "default_rubric" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "default_scenario" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "cohort_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "default_simulation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "simulation_ids";--> statement-breakpoint
ALTER TABLE "rubrics" DROP COLUMN "rubric_type";--> statement-breakpoint
DROP TYPE "public"."rubric_type";