CREATE TYPE "public"."agent_type" AS ENUM('title', 'scenario', 'classify', 'assistant', 'grade', 'guardrail');--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT "agents_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "assistant_chats" DROP CONSTRAINT "assistant_chats_profile_id_fkey";
--> statement-breakpoint
ALTER TABLE "assistant_messages" DROP CONSTRAINT "assistant_messages_chat_id_fkey";
--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" DROP CONSTRAINT "assistant_tool_calls_chat_id_fkey";
--> statement-breakpoint
ALTER TABLE "model_runs" DROP CONSTRAINT "model_runs_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_runs" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parameters" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "type" "agent_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "department_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_chats" ADD CONSTRAINT "assistant_chats_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;