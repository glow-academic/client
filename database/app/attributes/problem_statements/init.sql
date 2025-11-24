-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE problem_statements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name            TEXT        NOT NULL,
  problem_statement TEXT     NOT NULL
);

CREATE INDEX ON problem_statements (name);
CREATE INDEX ON problem_statements (created_at);

