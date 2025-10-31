-- Migration: Move flags from simulations to scenarios, add profile_activity table, add document_parameter
-- This migration:
-- 1. Adds 5 boolean flags to scenarios table
-- 2. Backfills flags from simulations via simulation_scenarios junction
-- 3. Creates profile_activity junction table for activity tracking
-- 4. Adds document_parameter to parameters table
-- 5. Removes flags from simulations table

BEGIN;

-- ============================================================================
-- PART 1: Add flags to scenarios table
-- ============================================================================

ALTER TABLE scenarios
  ADD COLUMN hints_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN image_input_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN input_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN output_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- PART 2: Backfill flags from simulations to scenarios
-- ============================================================================

-- For each scenario, use the most common value from linked simulations
-- If scenario has no linked simulations, use defaults (FALSE for most, TRUE for objectives_enabled)
-- Note: PostgreSQL doesn't have mode() function, so we use a subquery with COUNT and ORDER BY
UPDATE scenarios s
SET 
  hints_enabled = COALESCE((
    SELECT sim.hints_enabled
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.hints_enabled
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE),
  objectives_enabled = COALESCE((
    SELECT sim.objectives_enabled
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.objectives_enabled
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), TRUE),
  image_input_enabled = COALESCE((
    SELECT sim.image_input_active
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.image_input_active
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE),
  input_guardrail_enabled = COALESCE((
    SELECT sim.input_guardrail_active
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.input_guardrail_active
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE),
  output_guardrail_enabled = COALESCE((
    SELECT sim.output_guardrail_active
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.output_guardrail_active
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE);

-- ============================================================================
-- PART 3: Create profile_activity junction table
-- ============================================================================

CREATE TABLE profile_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON profile_activity (profile_id);
CREATE INDEX ON profile_activity (profile_id, last_active);
CREATE INDEX ON profile_activity (created_at);

-- Backfill: Insert one row per profile with current last_active value
INSERT INTO profile_activity (profile_id, last_active, created_at)
SELECT id, last_active, created_at
FROM profiles
WHERE last_active IS NOT NULL;

-- ============================================================================
-- PART 4: Add document_parameter to parameters table
-- ============================================================================

ALTER TABLE parameters
  ADD COLUMN document_parameter BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- PART 5: Remove flags from simulations table
-- ============================================================================

ALTER TABLE simulations
  DROP COLUMN hints_enabled,
  DROP COLUMN objectives_enabled,
  DROP COLUMN image_input_active,
  DROP COLUMN input_guardrail_active,
  DROP COLUMN output_guardrail_active;

-- ============================================================================
-- PART 6: Migrate system_prompt to prompts table
-- ============================================================================

-- Create prompts table and junction tables if they don't exist
-- (They may already exist if system/init.sql ran, but migration should be idempotent)
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

CREATE UNIQUE INDEX IF NOT EXISTS agent_prompts_one_active_per_agent
  ON agent_prompts(agent_id) WHERE active;

CREATE INDEX IF NOT EXISTS agent_prompts_agent_id_idx ON agent_prompts (agent_id);
CREATE INDEX IF NOT EXISTS agent_prompts_prompt_id_idx ON agent_prompts (prompt_id);
CREATE INDEX IF NOT EXISTS agent_prompts_agent_active_idx ON agent_prompts (agent_id, active);

CREATE TABLE IF NOT EXISTS persona_prompts (
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  prompt_id  UUID NOT NULL REFERENCES prompts(id) ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, prompt_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS persona_prompts_one_active_per_persona
  ON persona_prompts(persona_id) WHERE active;

CREATE INDEX IF NOT EXISTS persona_prompts_persona_id_idx ON persona_prompts (persona_id);
CREATE INDEX IF NOT EXISTS persona_prompts_prompt_id_idx ON persona_prompts (prompt_id);
CREATE INDEX IF NOT EXISTS persona_prompts_persona_active_idx ON persona_prompts (persona_id, active);

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

-- Extract agent system_prompts to prompts table and create junctions
-- For each agent, create a prompt and link it via agent_prompts
-- Link prompts to departments via prompt_departments (derive from agent_departments)
INSERT INTO prompts (id, system_prompt, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  a.system_prompt,
  a.created_at,
  a.updated_at
FROM agents a;

-- Create agent_prompts junctions
-- Match prompts to agents by system_prompt content (assuming unique prompts per agent for now)
INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
SELECT 
  a.id,
  p.id,
  true,
  a.created_at,
  a.updated_at
FROM agents a
JOIN prompts p ON p.system_prompt = a.system_prompt;

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

-- Extract persona system_prompts to prompts table and create junctions
-- For personas, create prompts and link via persona_prompts
INSERT INTO prompts (id, system_prompt, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  p.system_prompt,
  p.created_at,
  p.updated_at
FROM personas p
WHERE NOT EXISTS (
  SELECT 1 FROM prompts pr WHERE pr.system_prompt = p.system_prompt
);

-- Create persona_prompts junctions
INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
SELECT 
  p.id,
  pr.id,
  true,
  p.created_at,
  p.updated_at
FROM personas p
JOIN prompts pr ON pr.system_prompt = p.system_prompt;

-- Link persona prompts to departments via prompt_departments
-- Since personas don't have department links (cross-department), we'll skip department linking for now
-- Or link to all departments if needed - skipping for now as personas are cross-department

-- Remove system_prompt column from agents
ALTER TABLE agents DROP COLUMN system_prompt;

-- Remove system_prompt column from personas
ALTER TABLE personas DROP COLUMN system_prompt;

-- ============================================================================
-- PART 7: Move parameter_departments to parameter_item_departments
-- ============================================================================

-- Create parameter_item_departments table if it doesn't exist
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
DROP TABLE parameter_departments;

COMMIT;

