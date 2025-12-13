-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE agent_role AS ENUM (
  'classify', 
  'grade',
  'grade-text',
  'grade-voice',
  'hint',
  'input_guardrail',
  'output_guardrail',
  'scenario',
  'title',
  'image',
  'video',
  'simulation-text',
  'simulation-voice',
  'eval'
);

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  -- system_prompt moved to prompts table via agent_prompts junction (default prompt)
  -- temperature and reasoning moved to junction tables (agent_temperature_levels, agent_reasoning_levels)
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  role agent_role NOT NULL DEFAULT 'scenario',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE runs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  input_tokens INTEGER     NOT NULL DEFAULT 0,
  output_tokens INTEGER     NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER     NOT NULL DEFAULT 0,
  key_id     UUID        REFERENCES keys(id) ON DELETE SET NULL,
  agent_id   UUID        NOT NULL REFERENCES agents(id) ON DELETE RESTRICT
);

CREATE INDEX ON runs (key_id);
CREATE INDEX ON runs (agent_id);

-- Run junction tables (BCNF normalization - replaces nullable FKs)
CREATE TABLE run_models (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  model_id     UUID NOT NULL REFERENCES models(id)     ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, model_id)
);

CREATE UNIQUE INDEX one_model_per_run ON run_models(run_id);
CREATE INDEX ON run_models (model_id);

CREATE TABLE run_personas (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  persona_id   UUID NOT NULL REFERENCES personas(id)   ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, persona_id)
);

CREATE UNIQUE INDEX one_persona_per_run ON run_personas(run_id);
CREATE INDEX ON run_personas (persona_id);

-- Note: run_agents junction table removed - agent_id now denormalized in runs table

CREATE TABLE run_profiles (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id)   ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, profile_id)
);

CREATE UNIQUE INDEX one_profile_per_run ON run_profiles(run_id);
CREATE INDEX ON run_profiles (profile_id);

CREATE TABLE debug_info (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  run_id   UUID        NOT NULL REFERENCES runs(id),
  content TEXT        NOT NULL
);

-- Agent → Departments binary relationship table
-- Tracks which agents are available to departments (no prompt_id)
-- No records = available to all departments (cross-department)
CREATE TABLE agent_departments (
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, department_id)
);

CREATE INDEX ON agent_departments (agent_id);
CREATE INDEX ON agent_departments (department_id);
CREATE INDEX ON agent_departments (active);

-- Agent → Department → Prompts ternary relationship table (BCNF normalization)
-- Supports department-specific prompt overrides for agents
-- No records = available to all departments (cross-department)
CREATE TABLE agent_department_prompts (
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  prompt_id     UUID NOT NULL REFERENCES prompts(id) ON DELETE RESTRICT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, department_id, prompt_id)
);

CREATE INDEX ON agent_department_prompts (agent_id);
CREATE INDEX ON agent_department_prompts (department_id);
CREATE INDEX ON agent_department_prompts (prompt_id);

-- Only one active per (agent_id, prompt_id, department_id)
CREATE UNIQUE INDEX agent_department_prompts_one_active_per_agent_prompt_dept
  ON agent_department_prompts(agent_id, prompt_id, department_id) WHERE active = true;

-- Agent → Prompts junction table (default prompts)
-- Links agents to their default prompts (can be overridden per department via agent_department_prompts)
CREATE TABLE agent_prompts (
  agent_id    UUID NOT NULL REFERENCES agents(id)     ON DELETE CASCADE,
  prompt_id  UUID NOT NULL REFERENCES prompts(id)      ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, prompt_id)
);

CREATE INDEX ON agent_prompts (agent_id);
CREATE INDEX ON agent_prompts (prompt_id);
CREATE INDEX ON agent_prompts (agent_id, active);

-- Only one active prompt per agent
CREATE UNIQUE INDEX agent_prompts_one_active_per_agent
  ON agent_prompts(agent_id) WHERE active = true;

-- Agent voices junction table (references model_voices)
-- Agents can select multiple voices from their model's available voices
CREATE TABLE agent_voices (
  agent_id      UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model_voice_id UUID       NOT NULL REFERENCES model_voices(id) ON DELETE RESTRICT,
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, model_voice_id)
);

CREATE INDEX ON agent_voices (agent_id);
CREATE INDEX ON agent_voices (model_voice_id);
CREATE INDEX ON agent_voices (active);

-- Agent temperature levels junction table (references model_temperature_levels)
-- Agents select a single temperature level from their model's available levels
CREATE TABLE agent_temperature_levels (
  agent_id                  UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model_temperature_level_id UUID       NOT NULL REFERENCES model_temperature_levels(id) ON DELETE RESTRICT,
  active                    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, model_temperature_level_id)
);

CREATE INDEX ON agent_temperature_levels (agent_id);
CREATE INDEX ON agent_temperature_levels (model_temperature_level_id);
CREATE INDEX ON agent_temperature_levels (active);

-- Only one active temperature level per agent
CREATE UNIQUE INDEX agent_temperature_levels_one_active_per_agent
  ON agent_temperature_levels(agent_id) WHERE active = true;

-- Agent reasoning levels junction table (references model_reasoning_levels)
-- Agents select a single reasoning level from their model's available levels
CREATE TABLE agent_reasoning_levels (
  agent_id                UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model_reasoning_level_id UUID       NOT NULL REFERENCES model_reasoning_levels(id) ON DELETE RESTRICT,
  active                  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, model_reasoning_level_id)
);

CREATE INDEX ON agent_reasoning_levels (agent_id);
CREATE INDEX ON agent_reasoning_levels (model_reasoning_level_id);
CREATE INDEX ON agent_reasoning_levels (active);

-- Only one active reasoning level per agent
CREATE UNIQUE INDEX agent_reasoning_levels_one_active_per_agent
  ON agent_reasoning_levels(agent_id) WHERE active = true;

-- ============================================================================
-- Run → AI Generation Junction Tables
-- Links AI-generated objects to the runs that created them
-- Following Chris Date's "no nulls" principle - only AI-generated objects have entries
-- ============================================================================

-- Template → Runs junction table
CREATE TABLE template_runs (
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  run_id      UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, run_id)
);

CREATE INDEX ON template_runs (template_id);
CREATE INDEX ON template_runs (run_id);
CREATE INDEX ON template_runs (run_id, created_at);

-- Problem Statement → Runs junction table
CREATE TABLE problem_statement_runs (
  problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
  run_id               UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (problem_statement_id, run_id)
);

CREATE INDEX ON problem_statement_runs (problem_statement_id);
CREATE INDEX ON problem_statement_runs (run_id);
CREATE INDEX ON problem_statement_runs (run_id, created_at);

-- Objective → Runs junction table
CREATE TABLE objective_runs (
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  run_id       UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, run_id)
);

CREATE INDEX ON objective_runs (objective_id);
CREATE INDEX ON objective_runs (run_id);
CREATE INDEX ON objective_runs (run_id, created_at);

-- Note: outline_runs table removed in migration 90 (outlines feature deprecated)

-- Image → Runs junction table
CREATE TABLE image_runs (
  image_id  UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  run_id    UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (image_id, run_id)
);

CREATE INDEX ON image_runs (image_id);
CREATE INDEX ON image_runs (run_id);
CREATE INDEX ON image_runs (run_id, created_at);

-- Generation → Runs junction table
CREATE TABLE generation_runs (
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  run_id        UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (generation_id, run_id)
);

CREATE INDEX ON generation_runs (generation_id);
CREATE INDEX ON generation_runs (run_id);
CREATE INDEX ON generation_runs (run_id, created_at);
