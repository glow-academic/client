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
  icon_url   TEXT,
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
  value      TEXT        NOT NULL, -- Encrypted or plain text value
  encrypted  BOOLEAN     NOT NULL DEFAULT TRUE -- TRUE for encrypted secrets, FALSE for plain text config
);

CREATE INDEX ON auth_items (auth_id);
CREATE INDEX ON auth_items (auth_id, name);

-- Auth → Departments binary relationship table
-- Tracks which auth providers are available to departments
-- No records = available to all departments (cross-department)
CREATE TABLE auth_departments (
  auth_id       UUID NOT NULL REFERENCES auth(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_id, department_id)
);

CREATE INDEX ON auth_departments (auth_id);
CREATE INDEX ON auth_departments (department_id);
CREATE INDEX ON auth_departments (active);

