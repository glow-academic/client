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
  practice_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  document_parameter BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Parameter Items → Departments junction table (BCNF normalization)
-- Links parameter items to departments (moved from parameter_departments)
-- No records = available to all departments (cross-department)
CREATE TABLE parameter_item_departments (
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  department_id     UUID NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parameter_item_id, department_id)
);

CREATE INDEX ON parameter_item_departments (parameter_item_id);
CREATE INDEX ON parameter_item_departments (department_id);

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
  use_documents BOOLEAN NOT NULL DEFAULT FALSE,
  generated BOOLEAN     NOT NULL DEFAULT FALSE,
  active BOOLEAN     NOT NULL DEFAULT TRUE,
  hints_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  image_input_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  input_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  output_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- Scenario → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
CREATE TABLE scenario_departments (
  scenario_id   UUID NOT NULL REFERENCES scenarios(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, department_id)
);

CREATE INDEX ON scenario_departments (scenario_id);
CREATE INDEX ON scenario_departments (department_id);

-- Scenario problem statements table (supports historical tracking)
CREATE TABLE scenario_problem_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  problem_statement TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active problem statement per scenario
CREATE UNIQUE INDEX scenario_problem_statements_one_active_per_scenario
  ON scenario_problem_statements(scenario_id) WHERE active;

CREATE INDEX ON scenario_problem_statements(scenario_id);
CREATE INDEX ON scenario_problem_statements(scenario_id, active);

-- Scenario ↔ Persona junction table (BCNF normalization - replaces scenarios.persona_id)
CREATE TABLE scenario_personas (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  persona_id  UUID NOT NULL REFERENCES personas(id)  ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, persona_id)
);

-- One active persona per scenario (enforces single current persona)
CREATE UNIQUE INDEX scenario_personas_one_active_per_scenario
  ON scenario_personas(scenario_id)
  WHERE active;

CREATE INDEX ON scenario_personas (persona_id);
CREATE INDEX ON scenario_personas (scenario_id, active);

-- Scenario objectives collection table (BCNF normalization)
-- Normalized text collection pattern: composite PK with idx, created_at only
CREATE TABLE scenario_objectives (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  idx         INT  NOT NULL,
  objective   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scenario_id, idx)
);

CREATE INDEX ON scenario_objectives (scenario_id);

-- Scenario → Parameter Items junction table
CREATE TABLE scenario_parameter_items (
  scenario_id      UUID NOT NULL REFERENCES scenarios(id)       ON DELETE CASCADE,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, parameter_item_id)
);

CREATE INDEX ON scenario_parameter_items (scenario_id);
CREATE INDEX ON scenario_parameter_items (parameter_item_id);

-- Scenario → Documents junction table  
CREATE TABLE scenario_documents (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, document_id)
);

CREATE INDEX ON scenario_documents (scenario_id);
CREATE INDEX ON scenario_documents (document_id);

-- Document → Parameter Items junction table (BCNF normalization)
-- Allows documents to be filtered by parameter values
CREATE TABLE document_parameter_items (
  document_id       UUID NOT NULL REFERENCES documents(id)       ON DELETE CASCADE,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, parameter_item_id)
);

CREATE INDEX ON document_parameter_items (document_id);
CREATE INDEX ON document_parameter_items (parameter_item_id);

-- Scenario hierarchy with no NULLs (self-edge denotes root)
CREATE TABLE scenario_tree (
  parent_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  child_id  UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX ON scenario_tree (child_id);
CREATE INDEX ON scenario_tree (parent_id);

-- Enforce single parent per scenario (tree structure, not DAG)
CREATE UNIQUE INDEX scenario_tree_one_parent_per_child ON scenario_tree(child_id);