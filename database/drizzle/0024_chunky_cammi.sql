CREATE TYPE "public"."model_type" AS ENUM('ttt', 'tts', 'stt');--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "voice_agent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "stt_model_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "tts_model_id" uuid;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "model_type" "model_type" DEFAULT 'ttt' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_stt_model_id_fkey" FOREIGN KEY ("stt_model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_tts_model_id_fkey" FOREIGN KEY ("tts_model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;