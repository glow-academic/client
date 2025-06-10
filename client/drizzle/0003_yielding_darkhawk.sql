CREATE TABLE "eval_chat_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"passed" boolean NOT NULL,
	"score" integer NOT NULL,
	"time_taken" integer NOT NULL,
	"rubric_id" uuid NOT NULL,
	"eval_chat_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_chat_standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"standard_id" uuid NOT NULL,
	"eval_chat_rubric_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "simulation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"class_id" uuid NOT NULL,
	"simulation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_chat_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"passed" boolean NOT NULL,
	"score" integer NOT NULL,
	"time_taken" integer NOT NULL,
	"rubric_id" uuid NOT NULL,
	"simulation_chat_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_chat_standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"standard_id" uuid NOT NULL,
	"simulation_chat_rubric_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
);
--> statement-breakpoint
ALTER TABLE "attempts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rubric_grades" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "standard_grades" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "attempts" CASCADE;--> statement-breakpoint
DROP TABLE "rubric_grades" CASCADE;--> statement-breakpoint
DROP TABLE "standard_grades" CASCADE;--> statement-breakpoint
ALTER TABLE "simulation_chats" DROP CONSTRAINT "simulation_chats_rubric_grade_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_chats" DROP CONSTRAINT "simulation_chats_attempt_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_chat_rubrics" ADD CONSTRAINT "eval_chat_rubrics_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_rubrics" ADD CONSTRAINT "eval_chat_rubrics_eval_chat_id_fkey" FOREIGN KEY ("eval_chat_id") REFERENCES "public"."eval_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_standards" ADD CONSTRAINT "eval_chat_standards_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_standards" ADD CONSTRAINT "eval_chat_standards_eval_chat_rubric_id_fkey" FOREIGN KEY ("eval_chat_rubric_id") REFERENCES "public"."eval_chat_rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_rubrics" ADD CONSTRAINT "simulation_chat_rubrics_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_rubrics" ADD CONSTRAINT "simulation_chat_rubrics_simulation_chat_id_fkey" FOREIGN KEY ("simulation_chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_standards" ADD CONSTRAINT "simulation_chat_standards_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_standards" ADD CONSTRAINT "simulation_chat_standards_simulation_chat_rubric_id_fkey" FOREIGN KEY ("simulation_chat_rubric_id") REFERENCES "public"."simulation_chat_rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."simulation_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" DROP COLUMN "rubric_grade_id";