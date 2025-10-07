-- Apply department support migration (0019_add_department_support.sql)
-- This migration adds department_id columns and creates the departments table

-- Add department_id column to all specified tables (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'department_id') THEN
        ALTER TABLE "profiles" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'simulations' AND column_name = 'department_id') THEN
        ALTER TABLE "simulations" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rubrics' AND column_name = 'department_id') THEN
        ALTER TABLE "rubrics" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cohorts' AND column_name = 'department_id') THEN
        ALTER TABLE "cohorts" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'department_id') THEN
        ALTER TABLE "documents" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'department_id') THEN
        ALTER TABLE "providers" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenarios' AND column_name = 'department_id') THEN
        ALTER TABLE "scenarios" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personas' AND column_name = 'department_id') THEN
        ALTER TABLE "personas" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'model_runs' AND column_name = 'department_id') THEN
        ALTER TABLE "model_runs" ADD COLUMN "department_id" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parameters' AND column_name = 'department_id') THEN
        ALTER TABLE "parameters" ADD COLUMN "department_id" uuid;
    END IF;
END $$;

-- Create departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS "departments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "title_agent_id" uuid NOT NULL,
    "scenario_agent_id" uuid NOT NULL,
    "classify_agent_id" uuid NOT NULL,
    "assistant_agent_id" uuid NOT NULL,
    "grade_agent_id" uuid NOT NULL,
    "guardrail_agent_id" uuid NOT NULL
);

-- Create default agents for the CS department
INSERT INTO "agents" ("id", "name", "description", "system_prompt", "temperature") 
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Assistant', 'Default Assistant Agent', 'You are a helpful assistant.', 0.7),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Grade', 'Default Grade Agent', 'You are a grading assistant.', 0.7),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Scenario', 'Default Scenario Agent', 'You are a scenario assistant.', 0.7),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Classify', 'Default Classify Agent', 'You are a classification assistant.', 0.7),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Title', 'Default Title Agent', 'You are a title generation assistant.', 0.7),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Guardrail', 'Default Guardrail Agent', 'You are a guardrail assistant.', 0.7)
ON CONFLICT ("id") DO NOTHING;

-- Insert CS department if it doesn't exist
INSERT INTO "departments" ("id", "title", "description", "active", "title_agent_id", "scenario_agent_id", "classify_agent_id", "assistant_agent_id", "grade_agent_id", "guardrail_agent_id") 
VALUES (
    '33333333-3333-3333-3333-333333333333', 
    'Computer Science', 
    'Computer Science Department',
    true,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
)
ON CONFLICT ("id") DO NOTHING;

-- Insert Google provider if it doesn't exist
INSERT INTO "providers" ("id", "name", "description", "api_key", "department_id") 
VALUES ('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'TN+Erm+UHunHsh1EFi9XrygEVoU5k5iPEHb+jzpp+sQlLyPcWHqnJScJ0/Nv4QvsLjf5ObLczd+Mj7mHSv3XznhSAFOmciLZZxmddsD0aaFPIla7B4O1r5+MPFwk81CC', '33333333-3333-3333-3333-333333333333')
ON CONFLICT ("id") DO NOTHING;

-- Set department_id to CS department for all existing records (except profiles and rubrics)
UPDATE "simulations" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "rubrics" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "cohorts" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "documents" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "providers" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "scenarios" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "personas" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "model_runs" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;
UPDATE "parameters" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;

-- Add NOT NULL constraints to department_id columns (except profiles and rubrics)
ALTER TABLE "simulations" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "cohorts" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "providers" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "scenarios" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "personas" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "model_runs" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "agents" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "parameters" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "rubrics" ALTER COLUMN "department_id" SET NOT NULL;

-- Reset department_id to NULL for default/seed data users
UPDATE "profiles" SET "department_id" = NULL WHERE "id" IN (
  '965bd24f-dfae-4063-b370-e1373df46322', -- Ashok Saravanan
  '6a2518eb-eba7-4650-aee0-d387c3fb8265', -- Alex Siladie
  '34f445d6-7318-45a7-ba49-086b85b76b85', -- Ethan Dickey
  '456878aa-12ca-464b-86fe-fa22ebe58614'  -- Andres Bejarano
) AND "id" IS NOT NULL;

-- Add foreign key constraints (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_department_id_fkey') THEN
        ALTER TABLE "profiles" ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'simulations_department_id_fkey') THEN
        ALTER TABLE "simulations" ADD CONSTRAINT "simulations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'rubrics_department_id_fkey') THEN
        ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cohorts_department_id_fkey') THEN
        ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'documents_department_id_fkey') THEN
        ALTER TABLE "documents" ADD CONSTRAINT "documents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'providers_department_id_fkey') THEN
        ALTER TABLE "providers" ADD CONSTRAINT "providers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'scenarios_department_id_fkey') THEN
        ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'personas_department_id_fkey') THEN
        ALTER TABLE "personas" ADD CONSTRAINT "personas_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'model_runs_department_id_fkey') THEN
        ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'parameters_department_id_fkey') THEN
        ALTER TABLE "parameters" ADD CONSTRAINT "parameters_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;
    END IF;
END $$;

-- Migration completed successfully
SELECT 'Department support migration applied successfully!' as status;
