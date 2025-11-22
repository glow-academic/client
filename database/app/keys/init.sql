-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE key_type AS ENUM ('api', 'auth');

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE keys (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  key        TEXT        NOT NULL, -- This will be encrypted when stored in the database
  type       key_type    NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON keys (id);
CREATE INDEX ON keys (type);
CREATE INDEX ON keys (active);
CREATE INDEX ON keys (name);

