CREATE TYPE "public"."feedback_type" AS ENUM('feature', 'bug', 'question', 'other');--> statement-breakpoint
CREATE TABLE "app_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"profile_id" uuid,
	"type" "feedback_type" NOT NULL,
	"message" text
);
--> statement-breakpoint
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;