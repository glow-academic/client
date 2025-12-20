-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE problem_statements (
  id              UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name            TEXT        NOT NULL,
  problem_statement TEXT     NOT NULL
);

CREATE INDEX ON problem_statements (name);
CREATE INDEX ON problem_statements (created_at);

