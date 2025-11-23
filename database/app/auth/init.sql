-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE auth (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  provider_id TEXT       NOT NULL,
  slug        TEXT       NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON auth (id);
CREATE INDEX ON auth (active);
CREATE UNIQUE INDEX auth_slug_unique ON auth(slug);
CREATE INDEX auth_slug_idx ON auth(slug);

-- Auth items child table (one-to-many relationship with auth)
CREATE TABLE auth_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  auth_id    UUID        NOT NULL REFERENCES auth(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  value      TEXT        NOT NULL -- Encrypted value (similar to parameter_items.value)
);

CREATE INDEX ON auth_items (auth_id);
CREATE INDEX ON auth_items (auth_id, name);

