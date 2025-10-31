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
  description TEXT        NOT NULL,
  api_key TEXT        NOT NULL -- This will be encrypted when stored in the database
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