-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE departments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NOT NULL,
  active BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Department agents pivot table (BCNF normalization)
CREATE TABLE department_agents (
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (department_id, role)
);

CREATE INDEX ON department_agents (agent_id);
CREATE INDEX ON department_agents (department_id, role);