CREATE TYPE "public"."simulation_message_type" AS ENUM('query', 'response');--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "editable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "model_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_chats" ADD COLUMN "trace_id" text;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD COLUMN "tool_arguments" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD COLUMN "tool_result" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD COLUMN "completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_messages" ADD COLUMN "content" text NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_messages" ADD COLUMN "type" "simulation_message_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_messages" DROP COLUMN "query";--> statement-breakpoint
ALTER TABLE "simulation_messages" DROP COLUMN "response";