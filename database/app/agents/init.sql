-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  system_prompt     TEXT        NOT NULL,
  temperature  REAL     NOT NULL, -- 0.0-1.0
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  reasoning reasoning_effort NOT NULL DEFAULT 'medium',  -- NOT NULL with default 'medium'
  active BOOLEAN NOT NULL DEFAULT TRUE,
  default_agent BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE model_runs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  input_tokens INTEGER     NOT NULL DEFAULT 0,
  output_tokens INTEGER     NOT NULL DEFAULT 0,
  department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

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

-- Department agents pivot table (BCNF normalization)
-- Created here after agents table exists to satisfy foreign key dependency
CREATE TABLE department_agents (
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, role)
);

CREATE INDEX ON department_agents (agent_id);
CREATE INDEX ON department_agents (department_id, role);
