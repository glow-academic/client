-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

-- Problem Statements table (standalone, can exist independently)
CREATE TABLE problem_statements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name            TEXT        NOT NULL,
  problem_statement TEXT     NOT NULL
);

CREATE INDEX ON problem_statements (name);
CREATE INDEX ON problem_statements (created_at);

-- Objectives table (standalone, can exist independently)
CREATE TABLE objectives (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  objective  TEXT        NOT NULL
);

CREATE INDEX ON objectives (created_at);

CREATE TABLE parameters (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  numerical BOOLEAN     NOT NULL DEFAULT FALSE,
  active BOOLEAN     NOT NULL DEFAULT FALSE,
  practice_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  document_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  persona_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  policy_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  scenario_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  video_parameter BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE fields (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  value TEXT        NOT NULL,
  default_field BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Fields → Parameters junction table (BCNF normalization)
-- Many-to-many relationship: fields can be associated with multiple parameters
-- No records = field not associated with any parameter
CREATE TABLE field_parameters (
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (field_id, parameter_id)
);

CREATE INDEX ON field_parameters (field_id);
CREATE INDEX ON field_parameters (parameter_id);

-- Fields → Departments junction table (BCNF normalization)
-- Links fields to departments (moved from parameter_item_departments)
-- No records = available to all departments (cross-department)
CREATE TABLE field_departments (
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  department_id     UUID NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (field_id, department_id)
);

CREATE INDEX ON field_departments (field_id);
CREATE INDEX ON field_departments (department_id);

-- Parameters → Departments junction table (BCNF normalization)
-- Links parameters to departments
-- No records = available to all departments (cross-department)
CREATE TABLE parameter_departments (
  parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parameter_id, department_id)
);

CREATE INDEX ON parameter_departments (parameter_id);
CREATE INDEX ON parameter_departments (department_id);
  
CREATE TABLE scenarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  documents_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  document_vision_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  image_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  generated BOOLEAN     NOT NULL DEFAULT FALSE,
  active BOOLEAN     NOT NULL DEFAULT TRUE,
  scenario_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  image_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT
  -- Flags moved to simulation_scenarios junction table: hints_enabled, input_guardrail_enabled, output_guardrail_enabled, copy_paste_allowed
);

CREATE INDEX ON scenarios (scenario_agent_id);
CREATE INDEX ON scenarios (image_agent_id);

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

-- Scenario → Problem Statements junction table (BCNF normalization)
CREATE TABLE scenario_problem_statements (
  scenario_id         UUID NOT NULL REFERENCES scenarios(id)         ON DELETE CASCADE,
  problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, problem_statement_id)
);

CREATE INDEX ON scenario_problem_statements (scenario_id);
CREATE INDEX ON scenario_problem_statements (problem_statement_id);
CREATE INDEX ON scenario_problem_statements (scenario_id, active);

-- Scenario ↔ Persona junction table (BCNF normalization - replaces scenarios.persona_id)
CREATE TABLE scenario_personas (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  persona_id  UUID NOT NULL REFERENCES personas(id)  ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, persona_id)
);

CREATE INDEX ON scenario_personas (persona_id);
CREATE INDEX ON scenario_personas (scenario_id, active);

-- Scenario → Objectives junction table (BCNF normalization)
CREATE TABLE scenario_objectives (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  idx         INT  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scenario_id, objective_id)
);

CREATE INDEX ON scenario_objectives (scenario_id);
CREATE INDEX ON scenario_objectives (objective_id);

-- Scenario → Fields junction table
CREATE TABLE scenario_fields (
  scenario_id      UUID NOT NULL REFERENCES scenarios(id)       ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, field_id)
);

CREATE INDEX ON scenario_fields (scenario_id);
CREATE INDEX ON scenario_fields (field_id);

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

-- Scenario → Images junction table (BCNF normalization)
-- Links scenarios to images (strong entity)
CREATE TABLE scenario_images (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  image_id    UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, image_id)
);

CREATE INDEX ON scenario_images (scenario_id);
CREATE INDEX ON scenario_images (image_id);
CREATE INDEX ON scenario_images (scenario_id, active);

-- Document → Fields junction table (BCNF normalization)
-- Allows documents to be filtered by field values
CREATE TABLE document_fields (
  document_id       UUID NOT NULL REFERENCES documents(id)       ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, field_id)
);

CREATE INDEX ON document_fields (document_id);
CREATE INDEX ON document_fields (field_id);

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