-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE agent_type AS ENUM ('title', 'scenario', 'classify', 'assistant', 'grade', 'guardrail');

CREATE TABLE agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  system_prompt     TEXT        NOT NULL,
  temperature  REAL     NOT NULL, -- 0.0-1.0
  model_id UUID DEFAULT NULL REFERENCES models(id) ON DELETE SET NULL,
  reasoning reasoning_effort DEFAULT NULL,
  type agent_type NOT NULL,
  department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE model_runs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  model_id   UUID        DEFAULT NULL REFERENCES models(id) ON DELETE SET NULL,
  input_tokens INTEGER     NOT NULL DEFAULT 0,
  output_tokens INTEGER     NOT NULL DEFAULT 0,
  persona_id   UUID        NULL REFERENCES personas(id),
  agent_id     UUID        NULL REFERENCES agents(id),
  profile_id   UUID        NULL REFERENCES profiles(id),
  department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE debug_info (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  model_run_id   UUID        NOT NULL REFERENCES model_runs(id),
  content TEXT        NOT NULL
);
