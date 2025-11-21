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
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON auth (id);
CREATE INDEX ON auth (active);

-- Auth items child table (one-to-many relationship with auth)
CREATE TABLE auth_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  auth_id    UUID        NOT NULL REFERENCES auth(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL
);

CREATE INDEX ON auth_items (auth_id);
CREATE INDEX ON auth_items (auth_id, name);

-- Auth Items ↔ Keys junction table (BCNF normalization)
CREATE TABLE auth_item_keys (
  auth_item_id UUID NOT NULL REFERENCES auth_items(id) ON DELETE CASCADE,
  key_id       UUID NOT NULL REFERENCES keys(id)       ON DELETE CASCADE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_item_id, key_id)
);

CREATE INDEX ON auth_item_keys (auth_item_id);
CREATE INDEX ON auth_item_keys (key_id);
CREATE INDEX ON auth_item_keys (active);

