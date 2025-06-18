CREATE TABLE "cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"simulation_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"profile_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evals" ADD COLUMN "start_on_creation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "subtitle";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "agent_type";--> statement-breakpoint
ALTER TABLE "evals" DROP COLUMN "eval_type";--> statement-breakpoint
DROP TYPE "public"."agent_type";--> statement-breakpoint
DROP TYPE "public"."eval_type";