-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE providers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL
  -- api_key moved to keys table via model_keys junction
  -- base_url moved to provider_endpoints junction table
);

CREATE TABLE models (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  provider_id UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  input_ppm   FLOAT       NOT NULL DEFAULT 0.0, -- price per million input tokens (dollars) (free is 0.0)
  output_ppm  FLOAT       NOT NULL DEFAULT 0.0, -- price per million output tokens (dollars) (free is 0.0)
  cached_ppm  FLOAT       NOT NULL DEFAULT 0.0, -- cached price per million tokens (dollars) (free is 0.0)
  custom_model BOOLEAN     NOT NULL DEFAULT FALSE,
  image_model BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Provider endpoints junction table (BCNF normalization)
-- Stores base URLs for providers. Absence of record means default endpoint.
CREATE TABLE provider_endpoints (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL CHECK (base_url != ''),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id)
);

CREATE INDEX ON provider_endpoints (provider_id);

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