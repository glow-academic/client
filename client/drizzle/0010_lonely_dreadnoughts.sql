CREATE TYPE "public"."rubric_type" AS ENUM('simulation', 'eval');--> statement-breakpoint
ALTER TYPE "public"."user_role" RENAME TO "profile_role";--> statement-breakpoint
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
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"viewed_intro" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "profile_role" DEFAULT 'ta' NOT NULL,
	"class_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"sessionToken" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "verification_token_pkey" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "simulation_attempts" RENAME COLUMN "user_id" TO "profile_id";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_key";--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_attempts" DROP CONSTRAINT "simulation_attempts_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "agent_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "agent_type" SET DEFAULT 'student'::text;--> statement-breakpoint
DROP TYPE "public"."agent_type";--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('student', 'ta');--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "agent_type" SET DEFAULT 'student'::"public"."agent_type";--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "agent_type" SET DATA TYPE "public"."agent_type" USING "agent_type"::"public"."agent_type";--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "agent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "crowdedness" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "intensity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "seniority" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "seniority" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "documents" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "documents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "rubric_type" "rubric_type" DEFAULT 'simulation' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emailVerified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_profiles_user_id" ON "profiles" USING btree ("user_id" int4_ops);--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "viewed_intro";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "class_ids";