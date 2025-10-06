
-- Add department_id column to all specified tables (initially nullable for data migration)
ALTER TABLE "profiles" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "rubrics" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "model_runs" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "parameters" ADD COLUMN "department_id" uuid;--> statement-breakpoint

-- Add type column to agents table
ALTER TABLE "agents" ADD COLUMN "type" agent_type NOT NULL DEFAULT 'assistant';--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "parameters" ADD CONSTRAINT "parameters_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade;--> statement-breakpoint

-- Set department_id to CS department for all existing records (except profiles and rubrics)
UPDATE "simulations" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "rubrics" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "cohorts" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "documents" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "providers" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "scenarios" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "personas" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "model_runs" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "agents" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint
UPDATE "parameters" SET "department_id" = '33333333-3333-3333-3333-333333333333' WHERE "department_id" IS NULL;--> statement-breakpoint

-- Set agent types based on agent names
UPDATE "agents" SET "type" = 'assistant' WHERE "name" = 'Assistant';--> statement-breakpoint
UPDATE "agents" SET "type" = 'grade' WHERE "name" = 'Grade';--> statement-breakpoint
UPDATE "agents" SET "type" = 'scenario' WHERE "name" = 'Scenario';--> statement-breakpoint
UPDATE "agents" SET "type" = 'classify' WHERE "name" = 'Classify';--> statement-breakpoint
UPDATE "agents" SET "type" = 'title' WHERE "name" = 'Title';--> statement-breakpoint
UPDATE "agents" SET "type" = 'guardrail' WHERE "name" = 'Guardrail';--> statement-breakpoint

-- Add NOT NULL constraints to department_id columns (except profiles and rubrics)
ALTER TABLE "simulations" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_runs" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parameters" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rubrics" ALTER COLUMN "department_id" SET NOT NULL;--> statement-breakpoint

-- Reset department_id to NULL for default/seed data (safe updates)
-- Default profiles (from seed/init.sql) - only update if they exist
UPDATE "profiles" SET "department_id" = NULL WHERE "id" IN (
  '965bd24f-dfae-4063-b370-e1373df46322', -- Ashok Saravanan
  '6a2518eb-eba7-4650-aee0-d387c3fb8265', -- Alex Siladie
  '34f445d6-7318-45a7-ba49-086b85b76b85', -- Ethan Dickey
  '456878aa-12ca-464b-86fe-fa22ebe58614'  -- Andres Bejarano
) AND "id" IS NOT NULL;
