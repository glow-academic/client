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
-- PART 5: Insert parameter items and documents for new departments
-- Note: Parameters (Location and Class) are shared across departments
-- Location parameter ID: 2d82dfcc-7a67-5f57-98a5-74b1d138597e
-- Class parameter ID: 2dc4672e-4999-5d5a-802c-8fc69e07f150
-- ============================================================================

-- Create shared location items (HAAS, MATH, WALC) used by multiple departments
-- These match the shared items defined in database/seed/scenarios.sql
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Felix Haas Hall', 'A quiet, focused study environment in the lower level of the HAAS building. Used by multiple departments.', 'HAAS', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Mathematical Sciences Building', 'Houses Math and Statistics departments. Shared teaching and office space.', 'MATH', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Wilmeth Active Learning Center', 'Active learning spaces used by multiple departments for lectures and exams.', 'WALC', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Biology Department (fc3d3994-6274-4b87-ae85-2b845282c194)
-- Location parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('11111111-2222-3333-4444-aaaaaaaaaaaa', 'Lilly Hall of Life Sciences', 'Department main office and rooms.', 'LILY', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('11111111-2222-3333-4444-bbbbbbbbbbbb', 'Hansen Life Sciences Research Building', 'Several BIO faculty offices and labs.', 'HANS', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('11111111-2222-3333-4444-cccccccccccc', 'Whistler Hall of Agricultural Research', 'Life sciences research space used across BIO-related units.', 'WSLR', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Class parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('11111111-2222-3333-4444-dddddddddddd', 'BIOL 110', 'Fundamentals of Biology', 'BIOL110', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('11111111-2222-3333-4444-eeeeeeeeeeee', 'BIOL 204', 'Human Anatomy and Physiology', 'BIOL204', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('11111111-2222-3333-4444-ffffffffffff', 'BIOL 328', 'Principles of Physiology', 'BIOL328', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link Location parameter items to Biology department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('11111111-2222-3333-4444-aaaaaaaaaaaa', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-2222-3333-4444-bbbbbbbbbbbb', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-2222-3333-4444-cccccccccccc', 'fc3d3994-6274-4b87-ae85-2b845282c194')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Link Class parameter items to Biology department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('11111111-2222-3333-4444-dddddddddddd', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-2222-3333-4444-eeeeeeeeeeee', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('11111111-2222-3333-4444-ffffffffffff', 'fc3d3994-6274-4b87-ae85-2b845282c194')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Documents for Biology department
INSERT INTO documents (id, name, file_path, mime_type, type, classified, file_id) VALUES
  ('d0c11111-2222-3333-4444-111111111111', 'BIOL110-Lab1', 'BIOL110-Lab1.pdf', 'application/pdf', 'lab', false, 'biol-doc-1'),
  ('d0c11111-2222-3333-4444-222222222222', 'BIOL204-Exam1', 'BIOL204-Exam1.pdf', 'application/pdf', 'midterm', false, 'biol-doc-2'),
  ('d0c11111-2222-3333-4444-333333333333', 'BIOL328-HW3', 'BIOL328-HW3.pdf', 'application/pdf', 'homework', false, 'biol-doc-3')
ON CONFLICT (id) DO NOTHING;

-- Link documents to Biology department
INSERT INTO document_departments (document_id, department_id) VALUES
  ('d0c11111-2222-3333-4444-111111111111', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('d0c11111-2222-3333-4444-222222222222', 'fc3d3994-6274-4b87-ae85-2b845282c194'),
  ('d0c11111-2222-3333-4444-333333333333', 'fc3d3994-6274-4b87-ae85-2b845282c194')
ON CONFLICT (document_id, department_id) DO NOTHING;

-- Link documents to class parameter items (one per document)
INSERT INTO document_parameter_items (document_id, parameter_item_id) VALUES
  ('d0c11111-2222-3333-4444-111111111111', '11111111-2222-3333-4444-dddddddddddd'), -- BIOL110-Lab1 -> BIOL 110
  ('d0c11111-2222-3333-4444-222222222222', '11111111-2222-3333-4444-eeeeeeeeeeee'), -- BIOL204-Exam1 -> BIOL 204
  ('d0c11111-2222-3333-4444-333333333333', '11111111-2222-3333-4444-ffffffffffff') -- BIOL328-HW3 -> BIOL 328
ON CONFLICT (document_id, parameter_item_id) DO NOTHING;

-- Chemistry Department (5af0d09d-1661-4610-9e0c-f768d1e87e36)
-- Location parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('22222222-3333-4444-5555-aaaaaaaaaaaa', 'Wetherill Laboratory of Chemistry', 'Departmental space.', 'WTHR', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('22222222-3333-4444-5555-bbbbbbbbbbbb', 'Herbert C. Brown Laboratory of Chemistry', 'Departmental space.', 'BRWN', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('22222222-3333-4444-5555-cccccccccccc', 'Hansen Life Sciences', 'NMR facility location (Chem resource).', 'HANS', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Class parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('22222222-3333-4444-5555-dddddddddddd', 'CHM 112', 'General Chemistry', 'CHM112', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('22222222-3333-4444-5555-eeeeeeeeeeee', 'CHM 225', 'Organic Chemistry', 'CHM225', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('22222222-3333-4444-5555-ffffffffffff', 'CHM 342', 'Inorganic Chemistry', 'CHM342', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link Location parameter items to Chemistry department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('22222222-3333-4444-5555-aaaaaaaaaaaa', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-3333-4444-5555-bbbbbbbbbbbb', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-3333-4444-5555-cccccccccccc', '5af0d09d-1661-4610-9e0c-f768d1e87e36')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Link Class parameter items to Chemistry department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('22222222-3333-4444-5555-dddddddddddd', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-3333-4444-5555-eeeeeeeeeeee', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('22222222-3333-4444-5555-ffffffffffff', '5af0d09d-1661-4610-9e0c-f768d1e87e36')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Documents for Chemistry department
INSERT INTO documents (id, name, file_path, mime_type, type, classified, file_id) VALUES
  ('d0c22222-3333-4444-5555-111111111111', 'CHM112-Lab2', 'CHM112-Lab2.pdf', 'application/pdf', 'lab', false, 'chem-doc-1'),
  ('d0c22222-3333-4444-5555-222222222222', 'CHM225-HW4', 'CHM225-HW4.pdf', 'application/pdf', 'homework', false, 'chem-doc-2'),
  ('d0c22222-3333-4444-5555-333333333333', 'CHM342-Project1', 'CHM342-Project1.pdf', 'application/pdf', 'project', false, 'chem-doc-3')
ON CONFLICT (id) DO NOTHING;

-- Link documents to Chemistry department
INSERT INTO document_departments (document_id, department_id) VALUES
  ('d0c22222-3333-4444-5555-111111111111', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('d0c22222-3333-4444-5555-222222222222', '5af0d09d-1661-4610-9e0c-f768d1e87e36'),
  ('d0c22222-3333-4444-5555-333333333333', '5af0d09d-1661-4610-9e0c-f768d1e87e36')
ON CONFLICT (document_id, department_id) DO NOTHING;

-- Link documents to class parameter items (one per document)
INSERT INTO document_parameter_items (document_id, parameter_item_id) VALUES
  ('d0c22222-3333-4444-5555-111111111111', '22222222-3333-4444-5555-dddddddddddd'), -- CHM112-Lab2 -> CHM 112
  ('d0c22222-3333-4444-5555-222222222222', '22222222-3333-4444-5555-eeeeeeeeeeee'), -- CHM225-HW4 -> CHM 225
  ('d0c22222-3333-4444-5555-333333333333', '22222222-3333-4444-5555-ffffffffffff') -- CHM342-Project1 -> CHM 342
ON CONFLICT (document_id, parameter_item_id) DO NOTHING;

-- EAPS Department (001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb)
-- Location parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('44444444-5555-6666-7777-aaaaaaaaaaaa', 'Hampton Hall of Civil Engineering', 'Main EAPS home.', 'HAMP', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('44444444-5555-6666-7777-bbbbbbbbbbbb', 'Neil Armstrong Hall of Engineering', 'EAPS petrology facilities.', 'ARMS', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('44444444-5555-6666-7777-cccccccccccc', 'Brown Lab of Chemistry', 'EAPS petrology facilities.', 'BRWN', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Class parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('44444444-5555-6666-7777-dddddddddddd', 'EAPS 106', 'Geosciences in the Cinema', 'EAPS106', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('44444444-5555-6666-7777-eeeeeeeeeeee', 'EAPS 104', 'Oceanography', 'EAPS104', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('44444444-5555-6666-7777-ffffffffffff', 'EAPS 120', 'Geography', 'EAPS120', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link Location parameter items to EAPS department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('44444444-5555-6666-7777-aaaaaaaaaaaa', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-5555-6666-7777-bbbbbbbbbbbb', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-5555-6666-7777-cccccccccccc', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Link Class parameter items to EAPS department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('44444444-5555-6666-7777-dddddddddddd', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-5555-6666-7777-eeeeeeeeeeee', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('44444444-5555-6666-7777-ffffffffffff', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Documents for EAPS department
INSERT INTO documents (id, name, file_path, mime_type, type, classified, file_id) VALUES
  ('d0c44444-5555-6666-7777-111111111111', 'EAPS106-Project1', 'EAPS106-Project1.pdf', 'application/pdf', 'project', false, 'eaps-doc-1'),
  ('d0c44444-5555-6666-7777-222222222222', 'EAPS104-Lab3', 'EAPS104-Lab3.pdf', 'application/pdf', 'lab', false, 'eaps-doc-2'),
  ('d0c44444-5555-6666-7777-333333333333', 'EAPS120-HW2', 'EAPS120-HW2.pdf', 'application/pdf', 'homework', false, 'eaps-doc-3')
ON CONFLICT (id) DO NOTHING;

-- Link documents to EAPS department
INSERT INTO document_departments (document_id, department_id) VALUES
  ('d0c44444-5555-6666-7777-111111111111', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('d0c44444-5555-6666-7777-222222222222', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb'),
  ('d0c44444-5555-6666-7777-333333333333', '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb')
ON CONFLICT (document_id, department_id) DO NOTHING;

-- Link documents to class parameter items (one per document)
INSERT INTO document_parameter_items (document_id, parameter_item_id) VALUES
  ('d0c44444-5555-6666-7777-111111111111', '44444444-5555-6666-7777-dddddddddddd'), -- EAPS106-Project1 -> EAPS 106
  ('d0c44444-5555-6666-7777-222222222222', '44444444-5555-6666-7777-eeeeeeeeeeee'), -- EAPS104-Lab3 -> EAPS 104
  ('d0c44444-5555-6666-7777-333333333333', '44444444-5555-6666-7777-ffffffffffff') -- EAPS120-HW2 -> EAPS 120
ON CONFLICT (document_id, parameter_item_id) DO NOTHING;

-- Mathematics Department (0258cdab-7cf4-4d2f-96ec-98fae38df1bc)
-- Note: Shared location items (HAAS, MATH, WALC) are created above and linked below

-- Class parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('55555555-6666-7777-8888-dddddddddddd', 'MA 421', 'Linear Programming', 'MA421', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('55555555-6666-7777-8888-eeeeeeeeeeee', 'MA 265', 'Linear Algebra', 'MA265', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('55555555-6666-7777-8888-ffffffffffff', 'MA 261', 'Multivariate Calculus', 'MA261', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link shared Location parameter items to Mathematics department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'), -- Felix Haas Hall
  ('aaaaaaaa-0000-0000-0000-000000000002', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'), -- Mathematical Sciences Building
  ('aaaaaaaa-0000-0000-0000-000000000003', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc') -- Wilmeth Active Learning Center
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Link Class parameter items to Mathematics department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('55555555-6666-7777-8888-dddddddddddd', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('55555555-6666-7777-8888-eeeeeeeeeeee', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('55555555-6666-7777-8888-ffffffffffff', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Documents for Mathematics department
INSERT INTO documents (id, name, file_path, mime_type, type, classified, file_id) VALUES
  ('d0c55555-6666-7777-8888-111111111111', 'MA421-HW5', 'MA421-HW5.pdf', 'application/pdf', 'homework', false, 'ma-doc-1'),
  ('d0c55555-6666-7777-8888-222222222222', 'MA265-Exam2', 'MA265-Exam2.pdf', 'application/pdf', 'midterm', false, 'ma-doc-2'),
  ('d0c55555-6666-7777-8888-333333333333', 'MA261-Quiz3', 'MA261-Quiz3.pdf', 'application/pdf', 'quiz', false, 'ma-doc-3')
ON CONFLICT (id) DO NOTHING;

-- Link documents to Mathematics department
INSERT INTO document_departments (document_id, department_id) VALUES
  ('d0c55555-6666-7777-8888-111111111111', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('d0c55555-6666-7777-8888-222222222222', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc'),
  ('d0c55555-6666-7777-8888-333333333333', '0258cdab-7cf4-4d2f-96ec-98fae38df1bc')
ON CONFLICT (document_id, department_id) DO NOTHING;

-- Link documents to class parameter items (one per document)
INSERT INTO document_parameter_items (document_id, parameter_item_id) VALUES
  ('d0c55555-6666-7777-8888-111111111111', '55555555-6666-7777-8888-dddddddddddd'), -- MA421-HW5 -> MA 421
  ('d0c55555-6666-7777-8888-222222222222', '55555555-6666-7777-8888-eeeeeeeeeeee'), -- MA265-Exam2 -> MA 265
  ('d0c55555-6666-7777-8888-333333333333', '55555555-6666-7777-8888-ffffffffffff') -- MA261-Quiz3 -> MA 261
ON CONFLICT (document_id, parameter_item_id) DO NOTHING;

-- Physics Department (a9cc891d-859f-4ef8-b09d-2f6beabb618d)
-- Location parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('66666666-7777-8888-9999-aaaaaaaaaaaa', 'Physics Building', 'Department address and offices.', 'PHYS', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('66666666-7777-8888-9999-bbbbbbbbbbbb', 'Birck Nanotechnology Center', 'Physics research labs/quantum and nano.', 'BRK', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE),
  ('66666666-7777-8888-9999-cccccccccccc', 'Bindley Bioscience Center', 'Physics-affiliated facilities.', 'BIND', '2d82dfcc-7a67-5f57-98a5-74b1d138597e', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Class parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('66666666-7777-8888-9999-dddddddddddd', 'PHYS 172', 'Modern Mechanics', 'PHYS172', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('66666666-7777-8888-9999-eeeeeeeeeeee', 'PHYS 220', 'General Physics', 'PHYS220', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('66666666-7777-8888-9999-ffffffffffff', 'PHYS 545', 'Solid State Physics', 'PHYS545', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link Location parameter items to Physics department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('66666666-7777-8888-9999-aaaaaaaaaaaa', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-7777-8888-9999-bbbbbbbbbbbb', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-7777-8888-9999-cccccccccccc', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Link Class parameter items to Physics department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('66666666-7777-8888-9999-dddddddddddd', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-7777-8888-9999-eeeeeeeeeeee', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('66666666-7777-8888-9999-ffffffffffff', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Documents for Physics department
INSERT INTO documents (id, name, file_path, mime_type, type, classified, file_id) VALUES
  ('d0c66666-7777-8888-9999-111111111111', 'PHYS172-Lab4', 'PHYS172-Lab4.pdf', 'application/pdf', 'lab', false, 'phys-doc-1'),
  ('d0c66666-7777-8888-9999-222222222222', 'PHYS220-HW6', 'PHYS220-HW6.pdf', 'application/pdf', 'homework', false, 'phys-doc-2'),
  ('d0c66666-7777-8888-9999-333333333333', 'PHYS545-Project2', 'PHYS545-Project2.pdf', 'application/pdf', 'project', false, 'phys-doc-3')
ON CONFLICT (id) DO NOTHING;

-- Link documents to Physics department
INSERT INTO document_departments (document_id, department_id) VALUES
  ('d0c66666-7777-8888-9999-111111111111', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('d0c66666-7777-8888-9999-222222222222', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d'),
  ('d0c66666-7777-8888-9999-333333333333', 'a9cc891d-859f-4ef8-b09d-2f6beabb618d')
ON CONFLICT (document_id, department_id) DO NOTHING;

-- Link documents to class parameter items (one per document)
INSERT INTO document_parameter_items (document_id, parameter_item_id) VALUES
  ('d0c66666-7777-8888-9999-111111111111', '66666666-7777-8888-9999-dddddddddddd'), -- PHYS172-Lab4 -> PHYS 172
  ('d0c66666-7777-8888-9999-222222222222', '66666666-7777-8888-9999-eeeeeeeeeeee'), -- PHYS220-HW6 -> PHYS 220
  ('d0c66666-7777-8888-9999-333333333333', '66666666-7777-8888-9999-ffffffffffff') -- PHYS545-Project2 -> PHYS 545
ON CONFLICT (document_id, parameter_item_id) DO NOTHING;

-- Statistics Department (083f55e9-08af-4b0a-8e1b-32f28d3afea3)
-- Note: Shared location items (HAAS, MATH, WALC) are created above and linked below

-- Class parameter items
INSERT INTO parameter_items (id, name, description, value, parameter_id, default_item) VALUES
  ('77777777-8888-9999-aaaa-dddddddddddd', 'STAT 350', 'Introduction to Statistics', 'STAT350', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('77777777-8888-9999-aaaa-eeeeeeeeeeee', 'STAT 416', 'Probability', 'STAT416', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE),
  ('77777777-8888-9999-aaaa-ffffffffffff', 'STAT 417', 'Statistical Theory', 'STAT417', '2dc4672e-4999-5d5a-802c-8fc69e07f150', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link shared Location parameter items to Statistics department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'), -- Felix Haas Hall
  ('aaaaaaaa-0000-0000-0000-000000000002', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'), -- Mathematical Sciences Building
  ('aaaaaaaa-0000-0000-0000-000000000003', '083f55e9-08af-4b0a-8e1b-32f28d3afea3') -- Wilmeth Active Learning Center
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Link Class parameter items to Statistics department
INSERT INTO parameter_item_departments (parameter_item_id, department_id) VALUES
  ('77777777-8888-9999-aaaa-dddddddddddd', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('77777777-8888-9999-aaaa-eeeeeeeeeeee', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('77777777-8888-9999-aaaa-ffffffffffff', '083f55e9-08af-4b0a-8e1b-32f28d3afea3')
ON CONFLICT (parameter_item_id, department_id) DO NOTHING;

-- Documents for Statistics department
INSERT INTO documents (id, name, file_path, mime_type, type, classified, file_id) VALUES
  ('d0c77777-8888-9999-aaaa-111111111111', 'STAT350-HW7', 'STAT350-HW7.pdf', 'application/pdf', 'homework', false, 'stat-doc-1'),
  ('d0c77777-8888-9999-aaaa-222222222222', 'STAT416-Exam3', 'STAT416-Exam3.pdf', 'application/pdf', 'midterm', false, 'stat-doc-2'),
  ('d0c77777-8888-9999-aaaa-333333333333', 'STAT417-Project3', 'STAT417-Project3.pdf', 'application/pdf', 'project', false, 'stat-doc-3')
ON CONFLICT (id) DO NOTHING;

-- Link documents to Statistics department
INSERT INTO document_departments (document_id, department_id) VALUES
  ('d0c77777-8888-9999-aaaa-111111111111', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('d0c77777-8888-9999-aaaa-222222222222', '083f55e9-08af-4b0a-8e1b-32f28d3afea3'),
  ('d0c77777-8888-9999-aaaa-333333333333', '083f55e9-08af-4b0a-8e1b-32f28d3afea3')
ON CONFLICT (document_id, department_id) DO NOTHING;

-- Link documents to class parameter items (one per document)
INSERT INTO document_parameter_items (document_id, parameter_item_id) VALUES
  ('d0c77777-8888-9999-aaaa-111111111111', '77777777-8888-9999-aaaa-dddddddddddd'), -- STAT350-HW7 -> STAT 350
  ('d0c77777-8888-9999-aaaa-222222222222', '77777777-8888-9999-aaaa-eeeeeeeeeeee'), -- STAT416-Exam3 -> STAT 416
  ('d0c77777-8888-9999-aaaa-333333333333', '77777777-8888-9999-aaaa-ffffffffffff') -- STAT417-Project3 -> STAT 417
ON CONFLICT (document_id, parameter_item_id) DO NOTHING;

COMMIT;

