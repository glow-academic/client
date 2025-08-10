ALTER TABLE "model_runs" ALTER COLUMN "model_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "model_runs" ADD COLUMN "persona_id" uuid;--> statement-breakpoint
ALTER TABLE "model_runs" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "model_runs" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;