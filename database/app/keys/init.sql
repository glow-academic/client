-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE keys (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  key        TEXT        NOT NULL, -- This will be encrypted when stored in the database
  description TEXT       NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON keys (id);
CREATE INDEX ON keys (active);
CREATE INDEX ON keys (name);

-- Key → Departments binary relationship table
-- Tracks which keys are available to departments
-- No records = available to all departments (cross-department)
CREATE TABLE key_departments (
  key_id        UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key_id, department_id)
);

CREATE INDEX ON key_departments (key_id);
CREATE INDEX ON key_departments (department_id);
CREATE INDEX ON key_departments (active);

