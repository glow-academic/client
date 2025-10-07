ALTER TABLE "agents" DROP CONSTRAINT "agents_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "title_agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "scenario_agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "classify_agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "assistant_agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "grade_agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "guardrail_agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "department_id";--> statement-breakpoint
DROP TYPE "public"."agent_type";