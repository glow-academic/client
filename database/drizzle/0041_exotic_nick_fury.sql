CREATE TABLE "system_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"temperature" integer NOT NULL,
	"model_id" uuid,
	"reasoning" "reasoning_effort"
);
--> statement-breakpoint
ALTER TABLE "system_agents" ADD CONSTRAINT "system_agents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "editable";