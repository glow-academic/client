-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE modality_type AS ENUM ('text', 'video', 'audio', 'image');
CREATE TYPE pricing_type AS ENUM ('input', 'output', 'cached');
CREATE TYPE unit_category AS ENUM ('tokens', 'seconds', 'units');
CREATE TYPE quality AS ENUM ('low', 'medium', 'high');

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE models (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  name       TEXT         NOT NULL,
  description TEXT        NOT NULL,
  value      TEXT         NOT NULL,
  provider_id UUID        NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  active     BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX ON models (provider_id);

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


-- ============================================================================
-- PRICING AND CONSTRAINT TABLES
-- ============================================================================

-- Units reference table
CREATE TABLE units (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  unit_category unit_category NOT NULL,
  value         INTEGER       NOT NULL,
  active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Unique constraint on (name, value, unit_category) to allow multiple units with same value/category
-- but different names (e.g., million_text vs million_audio vs million_image)
CREATE UNIQUE INDEX units_unique_name_value_category_active
  ON units(name, value, unit_category) WHERE active = true;

CREATE INDEX ON units (unit_category);
CREATE INDEX ON units (value);
CREATE INDEX ON units (active);

-- Model reasoning levels junction table
CREATE TABLE model_reasoning_levels (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id        UUID            NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  reasoning_level reasoning_effort NOT NULL,
  active          BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (model_id, reasoning_level)
);

CREATE INDEX ON model_reasoning_levels (model_id);
CREATE INDEX ON model_reasoning_levels (reasoning_level);
CREATE INDEX ON model_reasoning_levels (active);

-- Model temperature levels junction table (with range support)
CREATE TABLE model_temperature_levels (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  temperature REAL        NOT NULL,
  is_upper    BOOLEAN     NOT NULL,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, temperature, is_upper),
  CHECK (temperature >= 0.0 AND temperature <= 2.0)
);

CREATE INDEX ON model_temperature_levels (model_id);
CREATE INDEX ON model_temperature_levels (temperature);
CREATE INDEX ON model_temperature_levels (active);

-- Model modalities junction table
-- Tracks input and output modalities per model (BCNF normalization)
-- Similar structure to model_temperature_levels with is_input boolean
CREATE TABLE model_modalities (
  model_id   UUID         NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  modality   modality_type NOT NULL,
  is_input   BOOLEAN     NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, modality, is_input)
);

CREATE INDEX ON model_modalities (model_id);
CREATE INDEX ON model_modalities (modality);
CREATE INDEX ON model_modalities (is_input);
CREATE INDEX ON model_modalities (active);


-- Model qualities junction table (for image models with quality levels)
CREATE TABLE model_qualities (
  model_id   UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  quality    quality     NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, quality)
);

CREATE INDEX ON model_qualities (model_id);
CREATE INDEX ON model_qualities (quality);
CREATE INDEX ON model_qualities (active);

-- Model voices junction table (uses voice enum from personas)
CREATE TABLE model_voices (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id   UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  voice      voice       NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, voice)
);

CREATE INDEX ON model_voices (model_id);
CREATE INDEX ON model_voices (voice);
CREATE INDEX ON model_voices (active);

-- Model pricing junction table
CREATE TABLE model_pricing (
  model_id       UUID         NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  pricing_type   pricing_type NOT NULL,
  unit_id        UUID         NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  price          REAL         NOT NULL,
  active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, pricing_type, unit_id)
);

CREATE INDEX ON model_pricing (model_id);
CREATE INDEX ON model_pricing (pricing_type);
CREATE INDEX ON model_pricing (unit_id);
CREATE INDEX ON model_pricing (active);

-- Run pricing usage junction table
-- Tracks usage metrics (token counts, seconds, image counts) by pricing type and unit
-- Enables dynamic pricing calculation by joining with model_pricing without storing actual prices (BCNF)
CREATE TABLE run_pricing_usage (
  run_id         UUID         NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  pricing_type   pricing_type NOT NULL,
  unit_id        UUID         NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  count          INTEGER      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, pricing_type, unit_id)
);

CREATE INDEX ON run_pricing_usage (run_id);
CREATE INDEX ON run_pricing_usage (pricing_type);
CREATE INDEX ON run_pricing_usage (unit_id);