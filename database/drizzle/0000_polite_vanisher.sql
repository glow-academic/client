-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."assistant_message_type" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."assistant_tool_type" AS ENUM('create', 'read', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('feature', 'bug', 'question', 'other');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('superadmin', 'admin', 'instructional', 'ta', 'guest');--> statement-breakpoint
CREATE TYPE "public"."reasoning_effort" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."simulation_message_type" AS ENUM('query', 'response');--> statement-breakpoint
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
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"sessionToken" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"type" "document_type" DEFAULT 'homework' NOT NULL,
	"classified" boolean DEFAULT false NOT NULL,
	"file_id" text,
	"active" boolean DEFAULT true NOT NULL
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
	"viewed_chat" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "profile_role" DEFAULT 'guest' NOT NULL,
	"default_profile" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"api_key" text NOT NULL,
	"base_url" text
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL
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
	"default_rubric" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
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
CREATE TABLE "app_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"message" text,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
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
CREATE TABLE "app_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"profile_id" uuid,
	"type" "feedback_type" NOT NULL,
	"message" text
);
--> statement-breakpoint
CREATE TABLE "assistant_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"trace_id" text
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"chat_id" uuid NOT NULL,
	"role" "assistant_message_type" NOT NULL,
	"content" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"chat_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"tool_type" "assistant_tool_type" NOT NULL,
	"tool_arguments" jsonb NOT NULL,
	"tool_result" jsonb NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"temperature" real NOT NULL,
	"default_persona" boolean DEFAULT false NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"model_id" uuid,
	"reasoning" "reasoning_effort",
	"active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"temperature" real NOT NULL,
	"model_id" uuid,
	"reasoning" "reasoning_effort"
);
--> statement-breakpoint
CREATE TABLE "simulation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid,
	"simulation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"numerical" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parameter_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"value" text NOT NULL,
	"parameter_id" uuid NOT NULL,
	"default_item" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"persona_id" uuid,
	"parameter_item_ids" uuid[],
	"document_ids" uuid[],
	"default_scenario" boolean DEFAULT false NOT NULL,
	"practice_scenario" boolean DEFAULT false NOT NULL,
	"generated" boolean DEFAULT false NOT NULL,
	"parent_id" uuid,
	"active" boolean DEFAULT true NOT NULL
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
	"completed" boolean DEFAULT false NOT NULL,
	"trace_id" text
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
	"rubric_id" uuid NOT NULL,
	"default_simulation" boolean DEFAULT false NOT NULL,
	"practice_simulation" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chat_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" "simulation_message_type" NOT NULL,
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
CREATE TABLE "simulation_chat_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"standard_id" uuid NOT NULL,
	"simulation_chat_grade_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"profile_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"default_cohort" boolean DEFAULT false NOT NULL,
	"simulation_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "verification_token_pkey" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_groups" ADD CONSTRAINT "standard_groups_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_standard_group_id_fkey" FOREIGN KEY ("standard_group_id") REFERENCES "public"."standard_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_chats" ADD CONSTRAINT "assistant_chats_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_items" ADD CONSTRAINT "parameter_items_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "public"."parameters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."simulation_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_messages" ADD CONSTRAINT "simulation_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_simulation_chat_id_fkey" FOREIGN KEY ("simulation_chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_simulation_chat_grade_id_fkey" FOREIGN KEY ("simulation_chat_grade_id") REFERENCES "public"."simulation_chat_grades"("id") ON DELETE cascade ON UPDATE no action;
*/