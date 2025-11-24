-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE policies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT       NOT NULL,
  file_path  TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON policies (name);
CREATE INDEX ON policies (active);
CREATE INDEX ON policies (created_at);

