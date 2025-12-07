-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE providers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX providers_value_unique ON providers(value) WHERE active = true;
CREATE INDEX ON providers (active);

-- Provider endpoints junction table (BCNF normalization)
-- Stores base URLs for custom providers. Presence of record indicates custom provider.
-- Only one active base_url per provider (enforced by unique partial index).
CREATE TABLE provider_endpoints (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  base_url    TEXT NOT NULL CHECK (base_url != ''),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id)
);

CREATE INDEX ON provider_endpoints (provider_id);
CREATE INDEX ON provider_endpoints (active);

-- Only one active base_url per provider
CREATE UNIQUE INDEX provider_endpoints_one_active_per_provider
  ON provider_endpoints(provider_id) WHERE active = true;


