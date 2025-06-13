CREATE TYPE "public"."eval_message_type" AS ENUM('query', 'response');--> statement-breakpoint
ALTER TABLE "evals" RENAME COLUMN "num_parallel_runs" TO "max_parallel_runs";--> statement-breakpoint
ALTER TABLE "eval_runs" DROP CONSTRAINT "eval_runs_class_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_runs" DROP CONSTRAINT "eval_runs_scenario_id_fkey";
--> statement-breakpoint
ALTER TABLE "evals" DROP CONSTRAINT "evals_class_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_chats" ADD COLUMN "scenario_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_chats" ADD COLUMN "completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_messages" ADD COLUMN "content" text NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_messages" ADD COLUMN "type" "eval_message_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_chats" ADD CONSTRAINT "eval_chats_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_messages" DROP COLUMN "query";--> statement-breakpoint
ALTER TABLE "eval_messages" DROP COLUMN "response";--> statement-breakpoint
ALTER TABLE "eval_runs" DROP COLUMN "class_id";--> statement-breakpoint
ALTER TABLE "eval_runs" DROP COLUMN "scenario_id";--> statement-breakpoint
ALTER TABLE "evals" DROP COLUMN "class_id";