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
  -- system_prompt moved to prompts table via persona_prompts junction (default prompt)
  temperature  REAL     NOT NULL, -- 0.0-1.0
  color TEXT        NOT NULL, -- hex color code
  icon TEXT        NOT NULL, -- icon name, in Lucide Icons
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  reasoning reasoning_effort NOT NULL DEFAULT 'none',  -- NOT NULL with default 'none'
  active BOOLEAN NOT NULL DEFAULT FALSE
);

-- Persona → Departments binary relationship table
-- Tracks which personas are available to departments (no prompt_id)
-- No records = available to all departments (cross-department)
CREATE TABLE persona_departments (
  persona_id    UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, department_id)
);

CREATE INDEX ON persona_departments (persona_id);
CREATE INDEX ON persona_departments (department_id);
CREATE INDEX ON persona_departments (active);

-- Persona → Department → Prompts ternary relationship table (BCNF normalization)
-- Supports department-specific prompt overrides for personas
-- No records = available to all departments (cross-department)
CREATE TABLE persona_department_prompts (
  persona_id    UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
  prompt_id     UUID NOT NULL REFERENCES prompts(id)      ON DELETE RESTRICT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, department_id, prompt_id)
);

CREATE INDEX ON persona_department_prompts (persona_id);
CREATE INDEX ON persona_department_prompts (department_id);
CREATE INDEX ON persona_department_prompts (prompt_id);

-- Only one active per (persona_id, prompt_id, department_id)
CREATE UNIQUE INDEX persona_department_prompts_one_active_per_persona_prompt_dept
  ON persona_department_prompts(persona_id, prompt_id, department_id) WHERE active = true;

-- Persona → Prompts junction table (default prompts)
-- Links personas to their default prompts (can be overridden per department via persona_department_prompts)
CREATE TABLE persona_prompts (
  persona_id UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  prompt_id  UUID NOT NULL REFERENCES prompts(id)      ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, prompt_id)
);

CREATE INDEX ON persona_prompts (persona_id);
CREATE INDEX ON persona_prompts (prompt_id);
CREATE INDEX ON persona_prompts (persona_id, active);

-- Only one active prompt per persona
CREATE UNIQUE INDEX persona_prompts_one_active_per_persona
  ON persona_prompts(persona_id) WHERE active = true;