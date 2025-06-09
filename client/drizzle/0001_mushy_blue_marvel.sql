CREATE TYPE "public"."agent_type" AS ENUM('default', 'student', 'ta');--> statement-breakpoint
CREATE TYPE "public"."class_term" AS ENUM('fall', 'spring', 'summer');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');--> statement-breakpoint
CREATE TYPE "public"."eval_type" AS ENUM('student', 'ta');--> statement-breakpoint
CREATE TYPE "public"."seniority_levels" AS ENUM('freshman', 'sophomore', 'junior', 'senior');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'instructional', 'instructor', 'ta');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"subtitle" text NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"agent_type" "agent_type" DEFAULT 'student' NOT NULL,
	"temperature" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"class_id" uuid NOT NULL,
	"simulation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"class_code" text NOT NULL,
	"year" integer NOT NULL,
	"term" "class_term" DEFAULT 'fall' NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"class_id" uuid NOT NULL,
	"type" "document_type" DEFAULT 'homework' NOT NULL,
	"classified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"title" text NOT NULL,
	"eval_run_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chat_id" uuid NOT NULL,
	"query" text NOT NULL,
	"response" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"class_id" uuid NOT NULL,
	"eval_id" uuid NOT NULL,
	"query_agent_id" uuid NOT NULL,
	"response_agent_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"rubric_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"class_id" uuid,
	"base_agent_id" uuid NOT NULL,
	"scenario_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"agent_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"eval_type" "eval_type" DEFAULT 'student' NOT NULL,
	"max_turns" integer NOT NULL,
	"num_parallel_runs" integer NOT NULL,
	"rubric_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"document_type" "document_type",
	"time" timestamp with time zone NOT NULL,
	"schedule_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubric_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"passed" boolean NOT NULL,
	"score" integer NOT NULL,
	"time_taken" integer NOT NULL,
	"rubric_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"crowdedness" integer NOT NULL,
	"intensity" integer NOT NULL,
	"seniority" "seniority_levels" DEFAULT 'freshman' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"class_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"title" text NOT NULL,
	"scenario_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chat_id" uuid NOT NULL,
	"query" text NOT NULL,
	"response" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"class_id" uuid,
	"documents" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"time_limit" integer,
	"active" boolean DEFAULT true NOT NULL,
	"scenario_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"rubric_id" uuid
);
--> statement-breakpoint
CREATE TABLE "standard_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"standard_id" uuid NOT NULL,
	"rubric_grade_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "standard_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"points" integer NOT NULL,
	"pass_points" integer NOT NULL,
	"rubric_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"points" integer NOT NULL,
	"standard_group_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"prerequisite" boolean DEFAULT false NOT NULL,
	"class_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chats" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "chats" CASCADE;--> statement-breakpoint
DROP TABLE "messages" CASCADE;--> statement-breakpoint
ALTER TABLE "rubrics" DROP CONSTRAINT "rubrics_id_fkey";
--> statement-breakpoint
ALTER TABLE "rubrics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "viewed_intro" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'ta' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "class_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "points" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "pass_points" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chats" ADD CONSTRAINT "eval_chats_eval_run_id_fkey" FOREIGN KEY ("eval_run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_messages" ADD CONSTRAINT "eval_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."eval_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_eval_id_fkey" FOREIGN KEY ("eval_id") REFERENCES "public"."evals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_query_agent_id_fkey" FOREIGN KEY ("query_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_response_agent_id_fkey" FOREIGN KEY ("response_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evals" ADD CONSTRAINT "evals_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evals" ADD CONSTRAINT "evals_base_agent_id_fkey" FOREIGN KEY ("base_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_grades" ADD CONSTRAINT "rubric_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_messages" ADD CONSTRAINT "simulation_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_grades" ADD CONSTRAINT "standard_grades_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_grades" ADD CONSTRAINT "standard_grades_rubric_grade_id_fkey" FOREIGN KEY ("rubric_grade_id") REFERENCES "public"."rubric_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_groups" ADD CONSTRAINT "standard_groups_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_standard_group_id_fkey" FOREIGN KEY ("standard_group_id") REFERENCES "public"."standard_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" DROP COLUMN "passed";--> statement-breakpoint
ALTER TABLE "rubrics" DROP COLUMN "support";--> statement-breakpoint
ALTER TABLE "rubrics" DROP COLUMN "elaborated";--> statement-breakpoint
ALTER TABLE "rubrics" DROP COLUMN "time";--> statement-breakpoint
DROP TYPE "public"."chat_profile";--> statement-breakpoint
DROP TYPE "public"."chatprofile";