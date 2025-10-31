-- Migration: Add new departments and reorganize seed data
-- This migration:
-- 1. Adds 6 new departments (Biology, Chemistry, EAPS, Mathematics, Physics, Statistics)
-- 2. Ensures prompts infrastructure exists and backfills from agents/personas.system_prompt
-- 3. Drops system_prompt columns from agents and personas (after backfilling)
-- 4. Ensures parameter_item_departments table exists and backfills from parameter_departments
-- 5. Drops parameter_departments table (after backfilling)
-- 6. Links superadmins to all departments
-- 7. Inserts parameter items (Location and Class) for new departments
--
-- Note: This migration is idempotent and can run independently of migration_move_flags_to_scenarios.sql
-- It checks for column/table existence before performing operations

BEGIN;

-- ============================================================================
-- PART 1: Add new departments
-- ============================================================================

INSERT INTO departments (id, title, description, active) VALUES
  ('fc3d3994-6274-4b87-ae85-2b845282c194', 'Biology', 'BIOL', true),
  ('5af0d09d-1661-4610-9e0c-f768d1e87e36', 'Chemistry', 'CHM', true),
  ('001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb', 'Earth, Atmospheric, and Planetary Sciences', 'EAPS', true),
  ('0258cdab-7cf4-4d2f-96ec-98fae38df1bc', 'Mathematics', 'MA', true),
  ('a9cc891d-859f-4ef8-b09d-2f6beabb618d', 'Physics', 'PHYS', true),
  ('083f55e9-08af-4b0a-8e1b-32f28d3afea3', 'Statistics', 'STAT', true)
ON CONFLICT (id) DO NOTHING;

-- Note: Computer Science ('3f256cf4-cf5e-4eae-8804-8a204f867e58') already exists

-- ============================================================================
-- PART 2: Ensure prompts infrastructure exists (idempotent)
-- ============================================================================

-- Create prompts table if it doesn't exist (may already exist from migration_move_flags_to_scenarios.sql)
CREATE TABLE IF NOT EXISTS prompts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  system_prompt TEXT     NOT NULL
);

CREATE INDEX IF NOT EXISTS prompts_created_at_idx ON prompts (created_at);

CREATE TABLE IF NOT EXISTS agent_prompts (
  agent_id   UUID NOT NULL REFERENCES agents(id)   ON DELETE CASCADE,
  prompt_id  UUID NOT NULL REFERENCES prompts(id) ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS agent_prompts_agent_id_idx ON agent_prompts (agent_id);
CREATE INDEX IF NOT EXISTS agent_prompts_prompt_id_idx ON agent_prompts (prompt_id);
CREATE INDEX IF NOT EXISTS agent_prompts_agent_active_idx ON agent_prompts (agent_id, active);

-- Drop unique constraint if it exists (allow multiple active prompts per agent)
DROP INDEX IF EXISTS agent_prompts_one_active_per_agent;

CREATE TABLE IF NOT EXISTS persona_prompts (
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  prompt_id  UUID NOT NULL REFERENCES prompts(id) ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS persona_prompts_persona_id_idx ON persona_prompts (persona_id);
CREATE INDEX IF NOT EXISTS persona_prompts_prompt_id_idx ON persona_prompts (prompt_id);
CREATE INDEX IF NOT EXISTS persona_prompts_persona_active_idx ON persona_prompts (persona_id, active);

-- Drop unique constraint if it exists (allow multiple active prompts per persona)
DROP INDEX IF EXISTS persona_prompts_one_active_per_persona;

CREATE TABLE IF NOT EXISTS prompt_departments (
  prompt_id     UUID NOT NULL REFERENCES prompts(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, department_id)
);

CREATE INDEX IF NOT EXISTS prompt_departments_prompt_id_idx ON prompt_departments (prompt_id);
CREATE INDEX IF NOT EXISTS prompt_departments_department_id_idx ON prompt_departments (department_id);

-- Backfill prompts from agents and personas (if system_prompt columns exist)
-- Only backfill if columns exist and data hasn't been migrated yet
DO $$
BEGIN
  -- Check if agents.system_prompt column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'system_prompt'
  ) THEN
    -- Extract agent system_prompts to prompts table (one prompt per agent)
    -- Create prompts first, then link agents to their specific prompts
    INSERT INTO prompts (id, system_prompt, created_at, updated_at)
    SELECT 
      gen_random_uuid(),
      a.system_prompt,
      a.created_at,
      a.updated_at
    FROM agents a
    WHERE NOT EXISTS (
      SELECT 1 FROM agent_prompts ap 
      JOIN prompts p ON p.id = ap.prompt_id 
      WHERE ap.agent_id = a.id AND p.system_prompt = a.system_prompt
    );

    -- Create agent_prompts junctions
    -- Match each agent to its prompt by system_prompt content AND created_at timestamp
    -- This ensures each agent gets linked to its own prompt (one prompt per agent)
    INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
    SELECT 
      a.id,
      p.id,
      true,
      a.created_at,
      a.updated_at
    FROM agents a
    JOIN prompts p ON p.system_prompt = a.system_prompt 
      AND p.created_at = a.created_at  -- Match by creation time to ensure correct pairing
    WHERE NOT EXISTS (
      SELECT 1 FROM agent_prompts ap 
      WHERE ap.agent_id = a.id
    );

    -- Link agent prompts to departments via prompt_departments
    INSERT INTO prompt_departments (prompt_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
      ap.prompt_id,
      ad.department_id,
      ad.active,
      ad.created_at,
      ad.updated_at
    FROM agent_prompts ap
    JOIN agent_departments ad ON ad.agent_id = ap.agent_id
    WHERE NOT EXISTS (
      SELECT 1 FROM prompt_departments pd 
      WHERE pd.prompt_id = ap.prompt_id AND pd.department_id = ad.department_id
    );
  END IF;

  -- Check if personas.system_prompt column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'personas' AND column_name = 'system_prompt'
  ) THEN
    -- Extract persona system_prompts to prompts table (one prompt per persona, but dedupe by content)
    -- First, create unique prompts by system_prompt content
    INSERT INTO prompts (id, system_prompt, created_at, updated_at)
    SELECT 
      gen_random_uuid(),
      p.system_prompt,
      MIN(p.created_at),
      MAX(p.updated_at)
    FROM personas p
    WHERE NOT EXISTS (
      SELECT 1 FROM prompts pr WHERE pr.system_prompt = p.system_prompt
    )
    GROUP BY p.system_prompt;

    -- Create persona_prompts junctions (personas with same prompt content share the same prompt)
    INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
    SELECT 
      p.id,
      pr.id,
      true,
      p.created_at,
      p.updated_at
    FROM personas p
    JOIN prompts pr ON pr.system_prompt = p.system_prompt
    WHERE NOT EXISTS (
      SELECT 1 FROM persona_prompts pp 
      WHERE pp.persona_id = p.id
    );

    -- Link persona prompts to departments via prompt_departments (from persona_departments)
    INSERT INTO prompt_departments (prompt_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
      pp.prompt_id,
      pd.department_id,
      pd.active,
      pd.created_at,
      pd.updated_at
    FROM persona_prompts pp
    JOIN persona_departments pd ON pd.persona_id = pp.persona_id
    WHERE NOT EXISTS (
      SELECT 1 FROM prompt_departments pdd 
      WHERE pdd.prompt_id = pp.prompt_id AND pdd.department_id = pd.department_id
    );
  END IF;
END $$;

-- Drop system_prompt columns if they exist (after backfilling)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'system_prompt'
  ) THEN
    ALTER TABLE agents DROP COLUMN system_prompt;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'personas' AND column_name = 'system_prompt'
  ) THEN
    ALTER TABLE personas DROP COLUMN system_prompt;
  END IF;
END $$;

-- ============================================================================
-- PART 3: Ensure parameter_item_departments table exists and migrate data (idempotent)
-- ============================================================================

-- Create parameter_item_departments table if it doesn't exist
-- (May already exist from migration_move_flags_to_scenarios.sql)
CREATE TABLE IF NOT EXISTS parameter_item_departments (
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  department_id     UUID NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parameter_item_id, department_id)
);

CREATE INDEX IF NOT EXISTS parameter_item_departments_item_id_idx ON parameter_item_departments (parameter_item_id);
CREATE INDEX IF NOT EXISTS parameter_item_departments_dept_id_idx ON parameter_item_departments (department_id);

-- Backfill parameter_item_departments from parameter_departments (if parameter_departments exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'parameter_departments'
  ) THEN
    -- Backfill: For each parameter in parameter_departments, find all its parameter_items
    -- and create parameter_item_departments entries
    INSERT INTO parameter_item_departments (parameter_item_id, department_id, active, created_at, updated_at)
    SELECT 
      pi.id,
      pd.department_id,
      pd.active,
      pd.created_at,
      pd.updated_at
    FROM parameter_departments pd
    JOIN parameter_items pi ON pi.parameter_id = pd.parameter_id
    WHERE NOT EXISTS (
      SELECT 1 FROM parameter_item_departments pid
      WHERE pid.parameter_item_id = pi.id AND pid.department_id = pd.department_id
    );

    -- Drop parameter_departments table (no longer needed)
    DROP TABLE IF EXISTS parameter_departments;
  END IF;
END $$;

-- ============================================================================
-- PART 4: Link superadmins to all departments
-- ============================================================================

-- Link superadmins to all departments
-- Note: CS department is primary, others are secondary
INSERT INTO profile_departments (profile_id, department_id, is_primary)
SELECT 
  p.id,
  d.id,
  CASE WHEN d.id = '3f256cf4-cf5e-4eae-8804-8a204f867e58' THEN true ELSE false END
FROM profiles p
CROSS JOIN departments d
WHERE p.role = 'superadmin'
  AND d.active = true
  AND NOT EXISTS (
    SELECT 1 FROM profile_departments pd 
    WHERE pd.profile_id = p.id AND pd.department_id = d.id
  );

-- ============================================================================
-- PART 5: Insert parameter items for new departments
-- ============================================================================

-- Biology Department (fc3d3994-6274-4b87-ae85-2b845282c194)
-- Location parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('11111111-biol-loc-1111-111111111111', 'Location', 'Where the interaction is taking place', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('11111111-biol-loc-0001-111111111111', 'Lilly Hall of Life Sciences', 'Department main office and rooms.', 'LILY', '11111111-biol-loc-1111-111111111111', TRUE),
  ('11111111-biol-loc-0002-111111111111', 'Hansen Life Sciences Research Building', 'Several BIO faculty offices and labs.', 'HANS', '11111111-biol-loc-1111-111111111111', TRUE),
  ('11111111-biol-loc-0003-111111111111', 'Whistler Hall of Agricultural Research', 'Life sciences research space used across BIO-related units.', 'WSLR', '11111111-biol-loc-1111-111111111111', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('11111111-biol-loc-0001-111111111111', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-biol-loc-0002-111111111111', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-biol-loc-0003-111111111111', 'fc3d3994-6274-4b87-ae85-2b845282c194')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Class parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('11111111-biol-cls-1111-111111111111', 'Class', 'Which course or subject the scenario is about', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('11111111-biol-cls-0001-111111111111', 'BIOL 110', 'Fundamentals of Biology', 'BIOL110', '11111111-biol-cls-1111-111111111111', TRUE),
  ('11111111-biol-cls-0002-111111111111', 'BIOL 204', 'Human Anatomy and Physiology', 'BIOL204', '11111111-biol-cls-1111-111111111111', TRUE),
  ('11111111-biol-cls-0003-111111111111', 'BIOL 328', 'Principles of Physiology', 'BIOL328', '11111111-biol-cls-1111-111111111111', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('11111111-biol-cls-0001-111111111111', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-biol-cls-0002-111111111111', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-biol-cls-0003-111111111111', 'fc3d3994-6274-4b87-ae85-2b845282c194')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Chemistry Department (5af0d09d-1661-4610-9e0c-f768d1e87e36)
-- Location parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('22222222-chem-loc-2222-222222222222', 'Location', 'Where the interaction is taking place', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('22222222-chem-loc-0001-222222222222', 'Wetherill Laboratory of Chemistry', 'Departmental space.', 'WTHR', '22222222-chem-loc-2222-222222222222', TRUE),
  ('22222222-chem-loc-0002-222222222222', 'Herbert C. Brown Laboratory of Chemistry', 'Departmental space.', 'BRWN', '22222222-chem-loc-2222-222222222222', TRUE),
  ('22222222-chem-loc-0003-222222222222', 'Hansen Life Sciences', 'NMR facility location (Chem resource).', 'HANS', '22222222-chem-loc-2222-222222222222', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('22222222-chem-loc-0001-222222222222', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-chem-loc-0002-222222222222', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-chem-loc-0003-222222222222', '5af0d09d-1661-4610-9e0c-f768d1e87e36')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Class parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('22222222-chem-cls-2222-222222222222', 'Class', 'Which course or subject the scenario is about', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('22222222-chem-cls-0001-222222222222', 'CHM 112', 'General Chemistry', 'CHM112', '22222222-chem-cls-2222-222222222222', TRUE),
  ('22222222-chem-cls-0002-222222222222', 'CHM 225', 'Organic Chemistry', 'CHM225', '22222222-chem-cls-2222-222222222222', TRUE),
  ('22222222-chem-cls-0003-222222222222', 'CHM 342', 'Inorganic Chemistry', 'CHM342', '22222222-chem-cls-2222-222222222222', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('22222222-chem-cls-0001-222222222222', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-chem-cls-0002-222222222222', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-chem-cls-0003-222222222222', '5af0d09d-1661-4610-9e0c-f768d1e87e36')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- EAPS Department (001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb)
-- Location parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('44444444-eaps-loc-4444-444444444444', 'Location', 'Where the interaction is taking place', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('44444444-eaps-loc-0001-444444444444', 'Hampton Hall of Civil Engineering', 'Main EAPS home.', 'HAMP', '44444444-eaps-loc-4444-444444444444', TRUE),
  ('44444444-eaps-loc-0002-444444444444', 'Neil Armstrong Hall of Engineering', 'EAPS petrology facilities.', 'ARMS', '44444444-eaps-loc-4444-444444444444', TRUE),
  ('44444444-eaps-loc-0003-444444444444', 'Brown Lab of Chemistry', 'EAPS petrology facilities.', 'BRWN', '44444444-eaps-loc-4444-444444444444', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('44444444-eaps-loc-0001-444444444444', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-eaps-loc-0002-444444444444', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-eaps-loc-0003-444444444444', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Class parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('44444444-eaps-cls-4444-444444444444', 'Class', 'Which course or subject the scenario is about', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('44444444-eaps-cls-0001-444444444444', 'EAPS 106', 'Geosciences in the Cinema', 'EAPS106', '44444444-eaps-cls-4444-444444444444', TRUE),
  ('44444444-eaps-cls-0002-444444444444', 'EAPS 104', 'Oceanography', 'EAPS104', '44444444-eaps-cls-4444-444444444444', TRUE),
  ('44444444-eaps-cls-0003-444444444444', 'EAPS 120', 'Geography', 'EAPS120', '44444444-eaps-cls-4444-444444444444', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('44444444-eaps-cls-0001-444444444444', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-eaps-cls-0002-444444444444', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-eaps-cls-0003-444444444444', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Mathematics Department (0258cdab-7cf4-4d2f-96ec-98fae38df1bc)
-- Location parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('55555555-ma-loc-5555-555555555555', 'Location', 'Where the interaction is taking place', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('55555555-ma-loc-0001-555555555555', 'Mathematical Sciences Building', 'Houses Math (and Statistics).', 'MATH', '55555555-ma-loc-5555-555555555555', TRUE),
  ('55555555-ma-loc-0002-555555555555', 'Felix Haas Hall', 'Math heritage/teaching spaces referenced with the division''s namesake; used for classes.', 'HAAS', '55555555-ma-loc-5555-555555555555', TRUE),
  ('55555555-ma-loc-0003-555555555555', 'Wilmeth Active Learning Center', 'Many Math lectures/exams scheduled here.', 'WALC', '55555555-ma-loc-5555-555555555555', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('55555555-ma-loc-0001-555555555555', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('55555555-ma-loc-0002-555555555555', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('55555555-ma-loc-0003-555555555555', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Class parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('55555555-ma-cls-5555-555555555555', 'Class', 'Which course or subject the scenario is about', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('55555555-ma-cls-0001-555555555555', 'MA 421', 'Linear Programming', 'MA421', '55555555-ma-cls-5555-555555555555', TRUE),
  ('55555555-ma-cls-0002-555555555555', 'MA 265', 'Linear Algebra', 'MA265', '55555555-ma-cls-5555-555555555555', TRUE),
  ('55555555-ma-cls-0003-555555555555', 'MA 261', 'Multivariate Calculus', 'MA261', '55555555-ma-cls-5555-555555555555', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('55555555-ma-cls-0001-555555555555', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('55555555-ma-cls-0002-555555555555', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('55555555-ma-cls-0003-555555555555', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Physics Department (a9cc891d-859f-4ef8-b09d-2f6beabb618d)
-- Location parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('66666666-phys-loc-6666-666666666666', 'Location', 'Where the interaction is taking place', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('66666666-phys-loc-0001-666666666666', 'Physics Building', 'Department address and offices.', 'PHYS', '66666666-phys-loc-6666-666666666666', TRUE),
  ('66666666-phys-loc-0002-666666666666', 'Birck Nanotechnology Center', 'Physics research labs/quantum and nano.', 'BRK', '66666666-phys-loc-6666-666666666666', TRUE),
  ('66666666-phys-loc-0003-666666666666', 'Bindley Bioscience Center', 'Physics-affiliated facilities.', 'BIND', '66666666-phys-loc-6666-666666666666', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('66666666-phys-loc-0001-666666666666', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-phys-loc-0002-666666666666', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-phys-loc-0003-666666666666', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Class parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('66666666-phys-cls-6666-666666666666', 'Class', 'Which course or subject the scenario is about', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('66666666-phys-cls-0001-666666666666', 'PHYS 172', 'Modern Mechanics', 'PHYS172', '66666666-phys-cls-6666-666666666666', TRUE),
  ('66666666-phys-cls-0002-666666666666', 'PHYS 220', 'General Physics', 'PHYS220', '66666666-phys-cls-6666-666666666666', TRUE),
  ('66666666-phys-cls-0003-666666666666', 'PHYS 545', 'Solid State Physics', 'PHYS545', '66666666-phys-cls-6666-666666666666', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('66666666-phys-cls-0001-666666666666', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-phys-cls-0002-666666666666', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-phys-cls-0003-666666666666', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Statistics Department (083f55e9-08af-4b0a-8e1b-32f28d3afea3)
-- Location parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('77777777-stat-loc-7777-777777777777', 'Location', 'Where the interaction is taking place', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('77777777-stat-loc-0001-777777777777', 'Mathematical Sciences Building', 'Department home.', 'MATH', '77777777-stat-loc-7777-777777777777', TRUE),
  ('77777777-stat-loc-0002-777777777777', 'Felix Haas Hall', 'Listed as additional Statistics location.', 'HAAS', '77777777-stat-loc-7777-777777777777', TRUE),
  ('77777777-stat-loc-0003-777777777777', 'Wilmeth Active Learning Center', 'Recurring STAT course rooms.', 'WALC', '77777777-stat-loc-7777-777777777777', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('77777777-stat-loc-0001-777777777777', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('77777777-stat-loc-0002-777777777777', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('77777777-stat-loc-0003-777777777777', '083f55e9-08af-4b0a-8e1b-32f28d3afea3')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Class parameter
INSERT INTO parameters (id, name, description, numerical, active, practice_parameter, document_parameter) VALUES
  ('77777777-stat-cls-7777-777777777777', 'Class', 'Which course or subject the scenario is about', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('77777777-stat-cls-0001-777777777777', 'STAT 350', 'Introduction to Statistics', 'STAT350', '77777777-stat-cls-7777-777777777777', TRUE),
  ('77777777-stat-cls-0002-777777777777', 'STAT 416', 'Probability', 'STAT416', '77777777-stat-cls-7777-777777777777', TRUE),
  ('77777777-stat-cls-0003-777777777777', 'STAT 417', 'Statistical Theory', 'STAT417', '77777777-stat-cls-7777-777777777777', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('77777777-stat-cls-0001-777777777777', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('77777777-stat-cls-0002-777777777777', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('77777777-stat-cls-0003-777777777777', '083f55e9-08af-4b0a-8e1b-32f28d3afea3')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

COMMIT;

