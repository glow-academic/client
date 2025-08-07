ALTER TABLE "system_agents" RENAME TO "agents";--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT "system_agents_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "icon" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;