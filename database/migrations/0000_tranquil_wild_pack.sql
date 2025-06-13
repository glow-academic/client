CREATE TYPE "public"."agent_type" AS ENUM('student', 'ta');--> statement-breakpoint
CREATE TYPE "public"."class_term" AS ENUM('fall', 'spring', 'summer');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');--> statement-breakpoint
CREATE TYPE "public"."eval_type" AS ENUM('student', 'ta');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('admin', 'instructional', 'instructor', 'ta');--> statement-breakpoint
CREATE TYPE "public"."rubric_type" AS ENUM('simulation', 'eval');--> statement-breakpoint
CREATE TYPE "public"."seniority_levels" AS ENUM('freshman', 'sophomore', 'junior', 'senior');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refreshToken" text,
	"accessToken" text,
	"expiresAt" integer,
	"tokenType" text,
	"scope" text,
	"idToken" text,
	"sessionState" text
);
--> statement-breakpoint
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
CREATE TABLE "authenticator" (
	"credentialId" text NOT NULL,
	"userId" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_credentialId_unique" UNIQUE("credentialId")
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
CREATE TABLE "eval_chat_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"standard_id" uuid NOT NULL,
	"eval_chat_grade_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"feedback" text
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
	"agent_id" uuid NOT NULL,
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
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"viewed_intro" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "profile_role" DEFAULT 'ta' NOT NULL,
	"class_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"points" integer NOT NULL,
	"pass_points" integer NOT NULL,
	"rubric_type" "rubric_type" DEFAULT 'simulation' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
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
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"class_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid,
	"class_id" uuid NOT NULL,
	"simulation_id" uuid NOT NULL
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
	"time_limit" integer,
	"active" boolean DEFAULT true NOT NULL,
	"scenario_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"rubric_id" uuid NOT NULL
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
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"prerequisite" boolean DEFAULT false NOT NULL,
	"class_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" ADD CONSTRAINT "eval_chat_feedbacks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" ADD CONSTRAINT "eval_chat_feedbacks_eval_chat_grade_id_fkey" FOREIGN KEY ("eval_chat_grade_id") REFERENCES "public"."eval_chat_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_grades" ADD CONSTRAINT "eval_chat_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_grades" ADD CONSTRAINT "eval_chat_grades_eval_chat_id_fkey" FOREIGN KEY ("eval_chat_id") REFERENCES "public"."eval_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chats" ADD CONSTRAINT "eval_chats_eval_run_id_fkey" FOREIGN KEY ("eval_run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_messages" ADD CONSTRAINT "eval_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."eval_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_eval_id_fkey" FOREIGN KEY ("eval_id") REFERENCES "public"."evals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evals" ADD CONSTRAINT "evals_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evals" ADD CONSTRAINT "evals_base_agent_id_fkey" FOREIGN KEY ("base_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_simulation_chat_grade_id_fkey" FOREIGN KEY ("simulation_chat_grade_id") REFERENCES "public"."simulation_chat_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_simulation_chat_id_fkey" FOREIGN KEY ("simulation_chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chats" ADD CONSTRAINT "simulation_chats_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."simulation_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_messages" ADD CONSTRAINT "simulation_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_groups" ADD CONSTRAINT "standard_groups_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_standard_group_id_fkey" FOREIGN KEY ("standard_group_id") REFERENCES "public"."standard_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_profiles_user_id" ON "profiles" USING btree ("user_id" text_ops);