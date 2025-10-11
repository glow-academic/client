-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE parameters (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  numerical BOOLEAN     NOT NULL DEFAULT FALSE,
  active BOOLEAN     NOT NULL DEFAULT FALSE,
  default_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE parameter_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  value TEXT        NOT NULL,
  parameter_id UUID        NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
  default_item BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Note: Parameter item tags are now managed via simulation_tags → simulation_tag_parameter_items
-- See simulations/init.sql for tag-related tables
  
CREATE TABLE scenarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  problem_statement TEXT        NOT NULL,
  persona_id UUID         NULL REFERENCES personas(id)  ON DELETE SET NULL DEFAULT NULL,
  default_scenario BOOLEAN     NOT NULL DEFAULT FALSE,
  generated BOOLEAN     NOT NULL DEFAULT FALSE,
  active BOOLEAN     NOT NULL DEFAULT TRUE,
  department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

-- Scenario objectives junction table (BCNF normalization)
CREATE TABLE scenario_objectives (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  idx         INT  NOT NULL,
  objective   TEXT NOT NULL,
  PRIMARY KEY (scenario_id, idx)
);

CREATE INDEX ON scenario_objectives (scenario_id);

-- Scenario → Parameter Items junction table
CREATE TABLE scenario_parameter_items (
  scenario_id      UUID NOT NULL REFERENCES scenarios(id)       ON DELETE CASCADE,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  PRIMARY KEY (scenario_id, parameter_item_id)
);

CREATE INDEX ON scenario_parameter_items (scenario_id);
CREATE INDEX ON scenario_parameter_items (parameter_item_id);

-- Scenario → Documents junction table  
CREATE TABLE scenario_documents (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (scenario_id, document_id)
);

CREATE INDEX ON scenario_documents (scenario_id);
CREATE INDEX ON scenario_documents (document_id);

-- Scenario hierarchy with no NULLs (self-edge denotes root)
CREATE TABLE scenario_tree (
  parent_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  child_id  UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX ON scenario_tree (child_id);
CREATE INDEX ON scenario_tree (parent_id);

-- Enforce single parent per scenario (tree structure, not DAG)
CREATE UNIQUE INDEX scenario_tree_one_parent_per_child ON scenario_tree(child_id);