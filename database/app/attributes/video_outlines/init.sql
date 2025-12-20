-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE outlines (
  id              UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name            TEXT        NOT NULL,
  outline         TEXT        NOT NULL
);

CREATE INDEX ON outlines (name);
CREATE INDEX ON outlines (created_at);

