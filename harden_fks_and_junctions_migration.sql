-- ============================================================================
-- FK Hardening & Junction Table Migration
-- ============================================================================
-- This migration does four things:
-- 1. Hardens personas.model_id and agents.model_id (NOT NULL + RESTRICT)
-- 2. Moves remaining nullable FKs into junction tables with temporal state
-- 3. Adds active/created_at/updated_at to all existing link tables
-- 4. Removes obsolete persona flags
-- ============================================================================

-- ============================================================================
-- PART A: Harden personas.model_id and agents.model_id
-- ============================================================================

BEGIN;

-- A1. Personas.model_id: backfill check and harden
-- Fail fast if any nulls exist so you can decide on a backfill policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM personas WHERE model_id IS NULL) THEN
    RAISE EXCEPTION 'personas.model_id has NULLs; backfill policy required before hardening';
  END IF;
END$$;

-- Flip to NOT NULL and make FK restrictive
ALTER TABLE personas
  ALTER COLUMN model_id SET NOT NULL;

ALTER TABLE personas
  DROP CONSTRAINT IF EXISTS personas_model_id_fkey,
  ADD  CONSTRAINT personas_model_id_fkey
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE RESTRICT;

-- A2. Agents.model_id: same check and harden
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM agents WHERE model_id IS NULL) THEN
    RAISE EXCEPTION 'agents.model_id has NULLs; backfill policy required before hardening';
  END IF;
END$$;

ALTER TABLE agents
  ALTER COLUMN model_id SET NOT NULL;

ALTER TABLE agents
  DROP CONSTRAINT IF EXISTS agents_model_id_fkey,
  ADD  CONSTRAINT agents_model_id_fkey
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE RESTRICT;

COMMIT;

-- ============================================================================
-- PART B: Move nullable FKs to junction tables (with temporal state)
-- ============================================================================

-- B1. Profiles ↔ Users (replace profiles.user_id)
BEGIN;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_one_primary_per_user
  ON user_profiles(user_id) WHERE is_primary;

-- Backfill from profiles.user_id
INSERT INTO user_profiles (user_id, profile_id, is_primary)
SELECT user_id, id, TRUE
FROM profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, profile_id) DO NOTHING;

-- Note: Column drop is commented out - uncomment once app uses the junction
-- ALTER TABLE profiles DROP COLUMN user_id;

COMMIT;

-- B2. App feedback ↔ Profiles (replace app_feedback.profile_id)
BEGIN;

CREATE TABLE IF NOT EXISTS app_feedback_profiles (
  app_feedback_id INT  NOT NULL REFERENCES app_feedback(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'author',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_feedback_id, profile_id, role)
);

-- Backfill existing non-null links as role='author'
INSERT INTO app_feedback_profiles (app_feedback_id, profile_id)
SELECT id, profile_id
FROM app_feedback
WHERE profile_id IS NOT NULL
ON CONFLICT (app_feedback_id, profile_id, role) DO NOTHING;

-- Note: Column drop is commented out - uncomment once app uses the junction
-- ALTER TABLE app_feedback DROP COLUMN profile_id;

COMMIT;

-- B3. Scenarios ↔ Personas (replace scenarios.persona_id)
BEGIN;

CREATE TABLE IF NOT EXISTS scenario_personas (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  persona_id  UUID NOT NULL REFERENCES personas(id)  ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, persona_id)
);

-- One active persona per scenario (enforces single current persona)
CREATE UNIQUE INDEX IF NOT EXISTS scenario_personas_one_active_per_scenario
  ON scenario_personas(scenario_id)
  WHERE active;

-- Backfill from scenarios.persona_id
INSERT INTO scenario_personas (scenario_id, persona_id, active)
SELECT id, persona_id, TRUE
FROM scenarios
WHERE persona_id IS NOT NULL
ON CONFLICT (scenario_id, persona_id) DO NOTHING;

-- Note: Column drop is commented out - uncomment once app uses the junction
-- ALTER TABLE scenarios DROP COLUMN persona_id;

COMMIT;

-- B4. Simulation attempts ↔ Profiles (replace simulation_attempts.profile_id)
BEGIN;

CREATE TABLE IF NOT EXISTS attempt_profiles (
  attempt_id UUID NOT NULL REFERENCES simulation_attempts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id)           ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS attempt_profiles_one_active_per_attempt
  ON attempt_profiles(attempt_id)
  WHERE active;

-- Backfill
INSERT INTO attempt_profiles (attempt_id, profile_id, active)
SELECT id, profile_id, TRUE
FROM simulation_attempts
WHERE profile_id IS NOT NULL
ON CONFLICT (attempt_id, profile_id) DO NOTHING;

-- Note: Column drop is commented out - uncomment once app uses the junction
-- ALTER TABLE simulation_attempts DROP COLUMN profile_id;

COMMIT;

-- B5. Model runs ↔ {Model | Persona | Agent | Profile}
-- Replace the four nullable FKs with four link tables
BEGIN;

CREATE TABLE IF NOT EXISTS model_run_models (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  model_id     UUID NOT NULL REFERENCES models(id)     ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, model_id)
);

CREATE TABLE IF NOT EXISTS model_run_personas (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  persona_id   UUID NOT NULL REFERENCES personas(id)   ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, persona_id)
);

CREATE TABLE IF NOT EXISTS model_run_agents (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  agent_id     UUID NOT NULL REFERENCES agents(id)     ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, agent_id)
);

CREATE TABLE IF NOT EXISTS model_run_profiles (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id)   ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, profile_id)
);

-- Optional: enforce single of each per run
CREATE UNIQUE INDEX IF NOT EXISTS one_model_per_run   ON model_run_models(model_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_persona_per_run ON model_run_personas(model_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_agent_per_run   ON model_run_agents(model_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_profile_per_run ON model_run_profiles(model_run_id);

-- Backfill existing data
INSERT INTO model_run_models   (model_run_id, model_id)
SELECT id, model_id FROM model_runs WHERE model_id IS NOT NULL
ON CONFLICT (model_run_id, model_id) DO NOTHING;

INSERT INTO model_run_personas (model_run_id, persona_id)
SELECT id, persona_id FROM model_runs WHERE persona_id IS NOT NULL
ON CONFLICT (model_run_id, persona_id) DO NOTHING;

INSERT INTO model_run_agents   (model_run_id, agent_id)
SELECT id, agent_id FROM model_runs WHERE agent_id IS NOT NULL
ON CONFLICT (model_run_id, agent_id) DO NOTHING;

INSERT INTO model_run_profiles (model_run_id, profile_id)
SELECT id, profile_id FROM model_runs WHERE profile_id IS NOT NULL
ON CONFLICT (model_run_id, profile_id) DO NOTHING;

-- Note: Column drops are commented out - uncomment once app uses the junctions
-- ALTER TABLE model_runs
--   DROP COLUMN model_id,
--   DROP COLUMN persona_id,
--   DROP COLUMN agent_id,
--   DROP COLUMN profile_id;

COMMIT;

-- ============================================================================
-- PART C: Add temporal state columns to existing link tables
-- ============================================================================

BEGIN;

-- C1. Add columns to existing link tables

ALTER TABLE simulation_scenarios
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE scenario_parameter_items
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE scenario_documents
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE scenario_tree
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE cohort_profiles
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE cohort_simulations
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE simulation_tags
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE simulation_tag_documents
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE simulation_tag_parameter_items
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE profile_departments
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE department_agents
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMIT;

-- ============================================================================
-- PART D: Remove obsolete persona flags
-- ============================================================================

BEGIN;

ALTER TABLE personas
  DROP COLUMN IF EXISTS guardrail_active,
  DROP COLUMN IF EXISTS image_input_active;

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- What this achieves:
-- 1. No nullable FKs in core tables (optionality expressed by link presence)
-- 2. Temporal state (active, timestamps) for every relationship
-- 3. Clean separation for point-in-time analytics
-- 4. Manual updated_at tracking (application handles timestamp updates)
-- 
-- Next steps:
-- 1. Update application code to use new junction tables
-- 2. Update analytics materialized view to read from new junctions
-- 3. Uncomment column drops once application is migrated
-- ============================================================================

