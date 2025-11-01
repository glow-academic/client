-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE reasoning_effort AS ENUM ('none', 'minimal', 'low', 'medium', 'high');

CREATE TABLE personas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  -- system_prompt moved to prompts table via prompt_id (default prompt)
  prompt_id  UUID        NOT NULL REFERENCES prompts(id) ON DELETE RESTRICT,
  temperature  REAL     NOT NULL, -- 0.0-1.0
  color TEXT        NOT NULL, -- hex color code
  icon TEXT        NOT NULL, -- icon name, in Lucide Icons
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  reasoning reasoning_effort NOT NULL DEFAULT 'none',  -- NOT NULL with default 'none'
  active BOOLEAN NOT NULL DEFAULT FALSE
);

-- Persona → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
-- Supports department-specific prompt overrides via prompt_id column
CREATE TABLE persona_departments (
  persona_id    UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
  prompt_id     UUID NOT NULL REFERENCES prompts(id)      ON DELETE RESTRICT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, department_id, prompt_id)
);

CREATE INDEX ON persona_departments (persona_id);
CREATE INDEX ON persona_departments (department_id);
CREATE INDEX ON persona_departments (prompt_id);

-- Only one active per (persona_id, prompt_id, department_id)
CREATE UNIQUE INDEX persona_departments_one_active_per_persona_prompt_dept
  ON persona_departments(persona_id, prompt_id, department_id) WHERE active = true;