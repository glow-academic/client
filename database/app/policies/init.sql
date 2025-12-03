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

-- Policy → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
CREATE TABLE policy_departments (
  policy_id     UUID NOT NULL REFERENCES policies(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, department_id)
);

CREATE INDEX ON policy_departments (policy_id);
CREATE INDEX ON policy_departments (department_id);

-- Policy → Documents junction table (BCNF normalization)
CREATE TABLE policy_documents (
  policy_id   UUID NOT NULL REFERENCES policies(id)   ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, document_id)
);

CREATE INDEX ON policy_documents (policy_id);
CREATE INDEX ON policy_documents (document_id);

