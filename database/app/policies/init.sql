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
  upload_id  UUID        REFERENCES uploads(id) ON DELETE RESTRICT,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  classify_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT DEFAULT '434b105b-a302-5638-93c6-e4bbac94b4f0'::uuid
);

CREATE INDEX ON policies (name);
CREATE INDEX ON policies (active);
CREATE INDEX ON policies (created_at);
CREATE INDEX ON policies (upload_id);
CREATE INDEX ON policies (classify_agent_id);

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

-- Policy → Parameter Items junction table (BCNF normalization)
-- Allows policies to be filtered by parameter values
CREATE TABLE policy_parameter_items (
  policy_id         UUID NOT NULL REFERENCES policies(id)       ON DELETE CASCADE,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_id, parameter_item_id)
);

CREATE INDEX ON policy_parameter_items (policy_id);
CREATE INDEX ON policy_parameter_items (parameter_item_id);

