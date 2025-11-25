-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE provider AS ENUM ('openai', 'gemini', 'custom');
CREATE TYPE model_type AS ENUM ('text', 'video', 'audio', 'image');

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE models (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  provider   provider    NOT NULL,
  model_type model_type  NOT NULL DEFAULT 'text',
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  input_ppm   FLOAT       NOT NULL DEFAULT 0.0, -- price per million input tokens (dollars) (free is 0.0)
  output_ppm  FLOAT       NOT NULL DEFAULT 0.0, -- price per million output tokens (dollars) (free is 0.0)
  cached_ppm  FLOAT       NOT NULL DEFAULT 0.0, -- cached price per million tokens (dollars) (free is 0.0)
  image_model BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Model endpoints junction table (BCNF normalization)
-- Stores base URLs for custom models. Presence of record indicates custom model.
-- Only one active base_url per model (enforced by unique partial index).
CREATE TABLE model_endpoints (
  model_id   UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  base_url   TEXT NOT NULL CHECK (base_url != ''),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (model_id)
);

CREATE INDEX ON model_endpoints (model_id);
CREATE INDEX ON model_endpoints (active);

-- Only one active base_url per model
CREATE UNIQUE INDEX model_endpoints_one_active_per_model
  ON model_endpoints(model_id) WHERE active = true;

-- Models ↔ Keys junction table (BCNF normalization)
-- Links models to keys (keys table defined in app/keys/init.sql)
CREATE TABLE model_keys (
  model_id   UUID NOT NULL REFERENCES models(id)     ON DELETE CASCADE,
  key_id     UUID NOT NULL REFERENCES keys(id)       ON DELETE CASCADE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, key_id)
);

CREATE INDEX ON model_keys (model_id);
CREATE INDEX ON model_keys (key_id);
CREATE INDEX ON model_keys (active);

-- Model → Departments binary relationship table
-- Tracks which models are available to departments (no key_id)
-- No records = available to all departments (cross-department)
CREATE TABLE model_departments (
  model_id      UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, department_id)
);

CREATE INDEX ON model_departments (model_id);
CREATE INDEX ON model_departments (department_id);
CREATE INDEX ON model_departments (active);

-- Model → Department → Keys ternary relationship table (BCNF normalization)
-- Supports department-specific key overrides for models
-- No records = available to all departments (cross-department)
CREATE TABLE model_department_keys (
  model_id      UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  key_id        UUID NOT NULL REFERENCES keys(id) ON DELETE RESTRICT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, department_id, key_id)
);

CREATE INDEX ON model_department_keys (model_id);
CREATE INDEX ON model_department_keys (department_id);
CREATE INDEX ON model_department_keys (key_id);

-- Only one active per (model_id, department_id, key_id)
CREATE UNIQUE INDEX model_department_keys_one_active_per_model_dept_key
  ON model_department_keys(model_id, department_id, key_id) WHERE active = true;