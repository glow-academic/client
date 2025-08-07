ALTER TABLE "agents" RENAME TO "personas";--> statement-breakpoint
ALTER TABLE "scenarios" RENAME COLUMN "agent_id" TO "persona_id";--> statement-breakpoint
ALTER TABLE "personas" DROP CONSTRAINT "agents_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE set null ON UPDATE no action;