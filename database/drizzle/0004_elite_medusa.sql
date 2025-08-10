CREATE TABLE "debug_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_run_id" uuid NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_chat_crowdsourced_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"simulation_chat_feedback_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "simulation_crowdsourced_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"simulation_message_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"response" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parameters" ADD COLUMN "default_parameter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "checkpoints" text[];--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD COLUMN "infinite_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD COLUMN "checkpoints_reached" boolean[] DEFAULT '{false}' NOT NULL;--> statement-breakpoint
ALTER TABLE "debug_info" ADD CONSTRAINT "debug_info_model_run_id_fkey" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_crowdsourced_feedbacks" ADD CONSTRAINT "simulation_chat_crowdsourced_f_simulation_chat_feedback_id_fkey" FOREIGN KEY ("simulation_chat_feedback_id") REFERENCES "public"."simulation_chat_feedbacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_crowdsourced_messages" ADD CONSTRAINT "simulation_crowdsourced_messages_simulation_message_id_fkey" FOREIGN KEY ("simulation_message_id") REFERENCES "public"."simulation_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_crowdsourced_messages" ADD CONSTRAINT "simulation_crowdsourced_messages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;