-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE uploads (
  id         UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  file_path  TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  size       BIGINT      NOT NULL
);

CREATE INDEX ON uploads (file_path);
CREATE INDEX ON uploads (created_at);

