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
  active BOOLEAN     NOT NULL DEFAULT FALSE,
  document_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  persona_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  scenario_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  video_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  simulation_parameter BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE fields (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  active BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Parameters → Fields junction table (BCNF normalization)
-- Many-to-many relationship: parameters can have multiple fields
-- Exactly one field must be marked as default per parameter
CREATE TABLE parameter_fields (
  parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  default            BOOLEAN NOT NULL DEFAULT FALSE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parameter_id, field_id)
);

CREATE INDEX ON parameter_fields (parameter_id);
CREATE INDEX ON parameter_fields (field_id);

-- Constraint: exactly one default field per parameter
CREATE UNIQUE INDEX parameter_fields_one_default_per_parameter ON parameter_fields(parameter_id) WHERE default = true;

-- Fields → Conditional Parameters junction table (BCNF normalization)
-- Allows fields to conditionally show other parameters when selected
-- Enables parameter chaining: if field A is selected, show parameter B
CREATE TABLE field_conditional_parameters (
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  conditional_parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (field_id, conditional_parameter_id)
);

CREATE INDEX ON field_conditional_parameters (field_id);
CREATE INDEX ON field_conditional_parameters (conditional_parameter_id);

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

-- Note: parameter_personas and parameter_documents junction tables removed in migration 91
-- Parameters are now linked to personas/documents via boolean flags (persona_parameter, document_parameter)

-- Scenarios → Parameters junction table (BCNF normalization)
-- Links scenarios to parameters (when scenario uses specific parameters)
-- No records = scenario not linked to any parameter
CREATE TABLE scenario_parameters (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, parameter_id)
);

CREATE INDEX ON scenario_parameters (scenario_id);
CREATE INDEX ON scenario_parameters (parameter_id);

  
CREATE TABLE scenarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  images_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  video_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  questions_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  generated BOOLEAN     NOT NULL DEFAULT FALSE,
  active BOOLEAN     NOT NULL DEFAULT TRUE,
  scenario_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  image_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  video_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT
  -- Flags moved to simulation_scenarios junction table: hints_enabled, input_guardrail_enabled, output_guardrail_enabled, copy_paste_allowed
  -- documents_enabled removed: template enabled inferred from document presence
);

CREATE INDEX ON scenarios (scenario_agent_id);
CREATE INDEX ON scenarios (image_agent_id);
CREATE INDEX ON scenarios (video_agent_id);

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

-- Scenarios ↔ Groups junction table (BCNF normalization)
CREATE TABLE scenario_groups (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, group_id)
);

CREATE INDEX ON scenario_groups (scenario_id);
CREATE INDEX ON scenario_groups (group_id);
CREATE UNIQUE INDEX scenario_groups_one_per_scenario ON scenario_groups(scenario_id);

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

-- Scenario → Videos junction table (BCNF normalization)
-- Links scenarios to videos (strong entity, like images)
-- Only 0 or 1 active video per scenario
CREATE TABLE scenario_videos (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, video_id)
);

CREATE INDEX ON scenario_videos (scenario_id);
CREATE INDEX ON scenario_videos (video_id);
CREATE INDEX ON scenario_videos (scenario_id, active);

-- Constraint: Only 0 or 1 active video per scenario
CREATE UNIQUE INDEX scenario_videos_one_active_per_scenario 
  ON scenario_videos(scenario_id) 
  WHERE active = true;

-- Scenario → Questions junction table (BCNF normalization)
-- Links scenarios to questions (replaces video_questions)
CREATE TABLE scenario_questions (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, question_id)
);

CREATE INDEX ON scenario_questions (scenario_id);
CREATE INDEX ON scenario_questions (question_id);
CREATE INDEX ON scenario_questions (scenario_id, active);

-- Scenario Question Times junction table (BCNF normalization)
-- Links scenario questions to videos with timestamps (replaces question_times)
-- Allows multiple timestamps per question per video
CREATE TABLE scenario_question_times (
  scenario_id UUID NOT NULL,
  question_id UUID NOT NULL,
  video_id    UUID NOT NULL,
  time        INTEGER NOT NULL, -- seconds into video when question appears
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, question_id, video_id, time),
  FOREIGN KEY (scenario_id, question_id) REFERENCES scenario_questions(scenario_id, question_id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id, video_id) REFERENCES scenario_videos(scenario_id, video_id) ON DELETE CASCADE
);

CREATE INDEX ON scenario_question_times (scenario_id, question_id);
CREATE INDEX ON scenario_question_times (scenario_id, video_id);
CREATE INDEX ON scenario_question_times (scenario_id, question_id, video_id, active);

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

-- Scenario Randomization Ranges Tables (BCNF normalization)
-- Store min/max ranges for randomization per scenario

-- Scenario → Persona Ranges (one row per scenario)
CREATE TABLE scenario_persona_ranges (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    min_count INTEGER NOT NULL DEFAULT 1,
    max_count INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scenario_id),
    CONSTRAINT scenario_persona_ranges_min_max_check 
        CHECK (min_count >= 1 AND max_count >= min_count)
);

CREATE INDEX ON scenario_persona_ranges (scenario_id);

-- Scenario → Document Ranges (one row per scenario)
CREATE TABLE scenario_document_ranges (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    min_count INTEGER NOT NULL DEFAULT 0,
    max_count INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scenario_id),
    CONSTRAINT scenario_document_ranges_min_max_check 
        CHECK (min_count >= 0 AND max_count >= min_count)
);

CREATE INDEX ON scenario_document_ranges (scenario_id);

-- Scenario → Parameter Ranges (one row per scenario)
CREATE TABLE scenario_parameter_ranges (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    min_count INTEGER NOT NULL DEFAULT 0,
    max_count INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scenario_id),
    CONSTRAINT scenario_parameter_ranges_min_max_check 
        CHECK (min_count >= 0 AND max_count >= min_count)
);

CREATE INDEX ON scenario_parameter_ranges (scenario_id);

-- Scenario → Field Ranges (multiple rows per scenario, one per parameter)
CREATE TABLE scenario_field_ranges (
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    parameter_id UUID NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
    min_count INTEGER NOT NULL DEFAULT 1,
    max_count INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scenario_id, parameter_id),
    CONSTRAINT scenario_field_ranges_min_max_check 
        CHECK (min_count >= 1 AND max_count >= min_count)
);

CREATE INDEX ON scenario_field_ranges (scenario_id);
CREATE INDEX ON scenario_field_ranges (parameter_id);
CREATE INDEX ON scenario_field_ranges (scenario_id, parameter_id);