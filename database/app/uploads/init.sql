-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE uploads (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  file_path  TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  size       BIGINT      NOT NULL
);

CREATE INDEX ON uploads (file_path);
CREATE INDEX ON uploads (created_at);

