-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE agent_role AS ENUM (
  'classify', 
  'grade',
  'hint',
  'input_guardrail',
  'output_guardrail',
  'scenario',
  'title',
  'image',
  'video'
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
  temperature  REAL     NOT NULL, -- 0.0-1.0
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  reasoning reasoning_effort NOT NULL DEFAULT 'medium',  -- NOT NULL with default 'medium'
  role agent_role NOT NULL DEFAULT 'scenario',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE model_runs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  input_tokens INTEGER     NOT NULL DEFAULT 0,
  output_tokens INTEGER     NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER     NOT NULL DEFAULT 0,
  key_id     UUID        REFERENCES keys(id) ON DELETE SET NULL
);

CREATE INDEX ON model_runs (key_id);

-- Model run junction tables (BCNF normalization - replaces nullable FKs)
CREATE TABLE model_run_models (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  model_id     UUID NOT NULL REFERENCES models(id)     ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, model_id)
);

CREATE UNIQUE INDEX one_model_per_run ON model_run_models(model_run_id);
CREATE INDEX ON model_run_models (model_id);

CREATE TABLE model_run_personas (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  persona_id   UUID NOT NULL REFERENCES personas(id)   ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, persona_id)
);

CREATE UNIQUE INDEX one_persona_per_run ON model_run_personas(model_run_id);
CREATE INDEX ON model_run_personas (persona_id);

CREATE TABLE model_run_agents (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  agent_id     UUID NOT NULL REFERENCES agents(id)     ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, agent_id)
);

CREATE UNIQUE INDEX one_agent_per_run ON model_run_agents(model_run_id);
CREATE INDEX ON model_run_agents (agent_id);

CREATE TABLE model_run_profiles (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id)   ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, profile_id)
);

CREATE UNIQUE INDEX one_profile_per_run ON model_run_profiles(model_run_id);
CREATE INDEX ON model_run_profiles (profile_id);

CREATE TABLE debug_info (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  model_run_id   UUID        NOT NULL REFERENCES model_runs(id),
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
