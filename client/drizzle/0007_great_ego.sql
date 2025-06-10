ALTER TABLE "eval_runs" RENAME COLUMN "response_agent_id" TO "agent_id";--> statement-breakpoint
ALTER TABLE "eval_runs" DROP CONSTRAINT "eval_runs_query_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_runs" DROP CONSTRAINT "eval_runs_response_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulations" DROP CONSTRAINT "simulations_rubric_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulations" ALTER COLUMN "rubric_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "standard_groups" ADD COLUMN "short_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" DROP COLUMN "query_agent_id";--> statement-breakpoint
ALTER TABLE "standards" DROP COLUMN "short_name";