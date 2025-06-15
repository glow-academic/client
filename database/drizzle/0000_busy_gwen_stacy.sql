-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."agent_type" AS ENUM('student', 'ta');--> statement-breakpoint
CREATE TYPE "public"."class_term" AS ENUM('fall', 'spring', 'summer');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');--> statement-breakpoint
CREATE TYPE "public"."eval_message_type" AS ENUM('query', 'response');--> statement-breakpoint
CREATE TYPE "public"."eval_type" AS ENUM('student', 'ta');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('admin', 'instructional', 'instructor', 'ta');--> statement-breakpoint
CREATE TYPE "public"."rubric_type" AS ENUM('simulation', 'eval');--> statement-breakpoint
CREATE TYPE "public"."seniority_levels" AS ENUM('freshman', 'sophomore', 'junior', 'senior');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" bigint,
	"id_token" text,
	"scope" text,
	"session_state" text,
	"token_type" text
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"class_code" text NOT NULL,
	"year" integer NOT NULL,
	"term" "class_term" DEFAULT 'fall' NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"prerequisite" boolean DEFAULT false NOT NULL,
	"class_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"class_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"sessionToken" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"document_type" "document_type",
	"time" timestamp with time zone NOT NULL,
	"schedule_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"class_id" uuid NOT NULL,
	"type" "document_type" DEFAULT 'homework' NOT NULL,
	"classified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"emailVerified" timestamp with time zone,
	"image" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer,
	"last_login" timestamp with time zone DEFAULT now() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"alias" text NOT NULL,
	"viewed_intro" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "profile_role" DEFAULT 'ta' NOT NULL,
	"class_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"subtitle" text NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"agent_type" "agent_type" DEFAULT 'student' NOT NULL,
	"temperature" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"points" integer NOT NULL,
	"pass_points" integer NOT NULL,
	"rubric_type" "rubric_type" DEFAULT 'simulation' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standard_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
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
CREATE TABLE "app_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"message_test" text,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"agent_id" uuid,
	"class_id" uuid,
	"crowdedness" integer,
	"intensity" integer,
	"seniority" "seniority_levels",
	"documents" uuid[]
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"time_limit" integer,
	"active" boolean DEFAULT true NOT NULL,
	"scenario_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"rubric_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid,
	"simulation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
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
CREATE TABLE "simulation_chat_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"passed" boolean NOT NULL,
	"score" integer NOT NULL,
	"time_taken" integer NOT NULL,
	"rubric_id" uuid NOT NULL,
	"simulation_chat_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"eval_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"rubric_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_chat_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"standard_id" uuid NOT NULL,
	"simulation_chat_grade_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "eval_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"title" text NOT NULL,
	"scenario_id" uuid NOT NULL,
	"eval_run_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"base_agent_id" uuid NOT NULL,
	"scenario_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"agent_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"rubric_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"eval_type" "eval_type" DEFAULT 'student' NOT NULL,
	"max_turns" integer NOT NULL,
	"max_parallel_runs" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chat_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" "eval_message_type" NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_chat_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"passed" boolean NOT NULL,
	"score" integer NOT NULL,
	"time_taken" integer NOT NULL,
	"rubric_id" uuid NOT NULL,
	"eval_chat_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_chat_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"standard_id" uuid NOT NULL,
	"eval_chat_grade_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "verification_token_pkey" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_groups" ADD CONSTRAINT "standard_groups_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_standard_group_id_fkey" FOREIGN KEY ("standard_group_id") REFERENCES "public"."standard_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."simulation_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_messages" ADD CONSTRAINT "simulation_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_simulation_chat_id_fkey" FOREIGN KEY ("simulation_chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_eval_id_fkey" FOREIGN KEY ("eval_id") REFERENCES "public"."evals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_simulation_chat_grade_id_fkey" FOREIGN KEY ("simulation_chat_grade_id") REFERENCES "public"."simulation_chat_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chats" ADD CONSTRAINT "eval_chats_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chats" ADD CONSTRAINT "eval_chats_eval_run_id_fkey" FOREIGN KEY ("eval_run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evals" ADD CONSTRAINT "evals_base_agent_id_fkey" FOREIGN KEY ("base_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_messages" ADD CONSTRAINT "eval_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."eval_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_grades" ADD CONSTRAINT "eval_chat_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_grades" ADD CONSTRAINT "eval_chat_grades_eval_chat_id_fkey" FOREIGN KEY ("eval_chat_id") REFERENCES "public"."eval_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" ADD CONSTRAINT "eval_chat_feedbacks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" ADD CONSTRAINT "eval_chat_feedbacks_eval_chat_grade_id_fkey" FOREIGN KEY ("eval_chat_grade_id") REFERENCES "public"."eval_chat_grades"("id") ON DELETE cascade ON UPDATE no action;
*/