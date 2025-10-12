-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE reasoning_effort AS ENUM ('minimal', 'low', 'medium', 'high');

CREATE TABLE personas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  system_prompt     TEXT        NOT NULL,
  temperature  REAL     NOT NULL, -- 0.0-1.0
  default_persona      BOOLEAN     NOT NULL DEFAULT FALSE,
  color TEXT        NOT NULL, -- hex color code
  icon TEXT        NOT NULL, -- icon name, in Lucide Icons
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  reasoning reasoning_effort DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);