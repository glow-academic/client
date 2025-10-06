-- Create departments table
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL
);--> statement-breakpoint

-- Add department_id column to all specified tables
ALTER TABLE "profiles" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "model_runs" ADD COLUMN "department_id" uuid;--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint

-- Insert CS department
INSERT INTO "departments" ("id", "title", "description") VALUES ('33333333-3333-3333-3333-333333333333', 'CS', 'Computer Science');--> statement-breakpoint

-- Set department_id to CS department for all existing records
UPDATE "profiles" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "simulations" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "rubrics" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "cohorts" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "documents" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "providers" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "scenarios" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "personas" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "model_runs" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint

-- Reset department_id to NULL for default/seed data (safe updates)
-- Default profiles (from users.sql) - only update if they exist
UPDATE "profiles" SET "department_id" = NULL WHERE "id" IN (
  'e1a1b2c3-d4e5-6789-0123-456789abcdef', -- Default Superadmin
  'f2b2c3d4-e5f6-7890-1234-567890abcdef', -- Default Admin
  'a3c3d4e5-f6a7-8901-2345-67890abcdef1', -- Default Instructional
  'b4d4e5f6-a7b8-9012-3456-7890abcdef12', -- Default TA
  'c5e5f6a7-b8c9-0123-4567-890abcdef123'  -- Default Guest
) AND "id" IS NOT NULL;--> statement-breakpoint

-- Default practice simulations (from simulations.sql) - only update if they exist
UPDATE "simulations" SET "department_id" = NULL WHERE "id" IN (
  'eeeeeeee-1111-2222-3333-444444444444', -- General Practice
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- Aggressive Practice
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Happy Practice
  'cccccccc-cccc-cccc-cccc-cccccccccccc', -- Confused Practice
  'dddddddd-dddd-dddd-dddd-dddddddddddd'  -- Passive Practice
) AND "id" IS NOT NULL;--> statement-breakpoint

-- Default rubric (from rubrics.sql) - only update if it exists
UPDATE "rubrics" SET "department_id" = NULL WHERE "id" = '33333333-3333-3333-3333-333333333333' AND "id" IS NOT NULL;--> statement-breakpoint

-- Default cohort (from cohorts.sql) - only update if it exists
UPDATE "cohorts" SET "department_id" = NULL WHERE "id" = 'd1e2f3a4-b5c6-7890-1234-56789abcdef0' AND "id" IS NOT NULL;--> statement-breakpoint

-- Default practice scenarios (from scenarios.sql) - only update if they exist
UPDATE "scenarios" SET "department_id" = NULL WHERE "id" IN (
  'eeeeeeee-1111-2222-3333-444444444444', -- General Scenario
  'aaaaaaaa-1111-2222-3333-444444444444', -- Aggressive Scenario
  'bbbbbbbb-1111-2222-3333-444444444444', -- Happy Scenario
  'cccccccc-1111-2222-3333-444444444444', -- Confused Scenario
  'dddddddd-1111-2222-3333-444444444444'  -- Passive Scenario
) AND "id" IS NOT NULL;--> statement-breakpoint

-- Default personas (from agents.sql) - only update if they exist
UPDATE "personas" SET "department_id" = NULL WHERE "id" IN (
  '11111111-aaaa-aaaa-aaaa-111111111111', -- Aggressive
  '22222222-bbbb-bbbb-bbbb-222222222222', -- Happy
  '33333333-cccc-cccc-cccc-333333333333', -- Confused
  '44444444-dddd-dddd-dddd-444444444444'  -- Passive
) AND "id" IS NOT NULL;--> statement-breakpoint