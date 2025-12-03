-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE images (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  upload_id  UUID        REFERENCES uploads(id) ON DELETE RESTRICT,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON images (name);
CREATE INDEX ON images (created_at);
CREATE INDEX ON images (active);
CREATE INDEX ON images (upload_id);

