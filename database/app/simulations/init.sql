-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system', 'developer');

CREATE TABLE simulations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT 'No description provided',
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  practice_simulation  BOOLEAN     NOT NULL           DEFAULT FALSE
  -- rubric_id moved to simulation_scenarios junction table
  -- time_limit moved to scenario_time_limits junction table (absence = infinite)
  -- Flags moved to simulation_scenarios junction table: hints_enabled, input_guardrail_enabled, output_guardrail_enabled
);

-- Simulation → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
CREATE TABLE simulation_departments (
  simulation_id UUID NOT NULL REFERENCES simulations(id)   ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, department_id)
);

CREATE INDEX ON simulation_departments (simulation_id);
CREATE INDEX ON simulation_departments (department_id);

-- Simulation → Scenarios junction table with ordering and scenario-specific settings
CREATE TABLE simulation_scenarios (
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  scenario_id   UUID NOT NULL REFERENCES scenarios(id)   ON DELETE CASCADE,
  position      INT  NOT NULL DEFAULT 1,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  hints_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  input_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  output_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  copy_paste_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  audio_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  text_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  show_problem_statement BOOLEAN NOT NULL DEFAULT TRUE,
  show_objectives BOOLEAN NOT NULL DEFAULT TRUE,
  show_image BOOLEAN NOT NULL DEFAULT TRUE,
  rubric_id UUID REFERENCES rubrics(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, scenario_id)
);

CREATE INDEX ON simulation_scenarios (simulation_id);
CREATE INDEX ON simulation_scenarios (scenario_id);
CREATE INDEX ON simulation_scenarios (rubric_id);

-- Enforce unique ordering within each simulation
CREATE UNIQUE INDEX simulation_scenarios_position_uniq
  ON simulation_scenarios(simulation_id, position);

-- Scenario time limits junction table (BCNF normalization)
-- Logic: If record exists -> use time limit, if no record -> infinite/no time limit
-- For attempts: simulation_attempts.infinite_mode flag determines if time limits apply
CREATE TABLE scenario_time_limits (
  simulation_id UUID NOT NULL,
  scenario_id UUID NOT NULL,
  time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (simulation_id, scenario_id),
  FOREIGN KEY (simulation_id, scenario_id) REFERENCES simulation_scenarios(simulation_id, scenario_id) ON DELETE CASCADE
);

CREATE INDEX ON scenario_time_limits (simulation_id);
CREATE INDEX ON scenario_time_limits (scenario_id);

-- Note: Simulation tags and tag-related tables (simulation_tags, simulation_tag_documents, 
-- simulation_tag_parameter_items, v_tagged_documents, v_tagged_parameter_items) 
-- have been removed as part of BCNF migration

CREATE TABLE simulation_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  simulation_id    UUID        NOT NULL REFERENCES simulations(id)  ON DELETE CASCADE,
  infinite_mode BOOLEAN     NOT NULL           DEFAULT FALSE,  -- If true, ignores all time limits
  -- infinite_mode_time_limit removed (was 100% NULL, never used)
  archived BOOLEAN     NOT NULL           DEFAULT FALSE
);

-- Simulation attempts ↔ Profiles junction table (BCNF normalization - replaces simulation_attempts.profile_id)
CREATE TABLE attempt_profiles (
  attempt_id UUID NOT NULL REFERENCES simulation_attempts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id)           ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, profile_id)
);

CREATE UNIQUE INDEX attempt_profiles_one_active_per_attempt
  ON attempt_profiles(attempt_id)
  WHERE active;

CREATE INDEX ON attempt_profiles (profile_id);
CREATE INDEX ON attempt_profiles (attempt_id, active);

CREATE TABLE chats (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  -- completed_at removed (use grades.time_taken as source of truth)
  title      TEXT         NOT NULL,
  scenario_id UUID         NOT NULL REFERENCES scenarios(id)  ON DELETE CASCADE,
  completed  BOOLEAN      NOT NULL           DEFAULT FALSE,
  trace_id   TEXT         NOT NULL -- openai trace id (NOT NULL, no default)
);

-- Simulation attempts ↔ Chats junction table (BCNF normalization - replaces chats.attempt_id)
CREATE TABLE attempt_chats (
  attempt_id UUID NOT NULL REFERENCES simulation_attempts(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, chat_id)
);

CREATE INDEX ON attempt_chats (attempt_id);
CREATE INDEX ON attempt_chats (chat_id);
CREATE INDEX ON attempt_chats (attempt_id, chat_id);

-- Run ↔ Chats junction table (BCNF normalization)
CREATE TABLE run_chats (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, chat_id)
);

CREATE INDEX ON run_chats (run_id);
CREATE INDEX ON run_chats (chat_id);

-- Unified messages table - all messages link to runs
CREATE TABLE messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  content    TEXT        NOT NULL,
  role       message_role NOT NULL,
  run_id     UUID        NOT NULL REFERENCES runs(id)  ON DELETE CASCADE,
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE,
  audio      BOOLEAN     NOT NULL           DEFAULT FALSE
);

CREATE INDEX ON messages (run_id);
CREATE INDEX ON messages (run_id, created_at);

-- Simulation hints collection table (BCNF normalization)
-- Normalized text collection pattern: composite PK with idx, created_at only (matches scenario_objectives)
CREATE TABLE simulation_hints (
  simulation_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  idx               INT  NOT NULL,
  hint              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (simulation_message_id, idx)
);

CREATE INDEX ON simulation_hints (simulation_message_id);

-- Unified grades table - all grades link to runs
CREATE TABLE grades (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    description TEXT        NOT NULL DEFAULT 'No description provided',
    passed     BOOLEAN     NOT NULL,
    score      INTEGER     NOT NULL,
    time_taken INTEGER     NOT NULL, -- in seconds
    rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE,
    run_id      UUID        NOT NULL REFERENCES runs(id)  ON DELETE CASCADE,
    eval        BOOLEAN     NOT NULL, -- true=eval grade, false=simulation grade
    eval_id     UUID        REFERENCES evals(id)  ON DELETE CASCADE, -- nullable, only when eval=true
    CHECK (eval = false OR eval_id IS NOT NULL)
);

CREATE INDEX ON grades (run_id);
CREATE INDEX ON grades (eval_id);
CREATE INDEX ON grades (run_id, eval, created_at DESC);

-- Unified feedbacks table
CREATE TABLE feedbacks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    standard_id   UUID        NOT NULL REFERENCES standards(id)  ON DELETE CASCADE,
    grade_id   UUID        NOT NULL REFERENCES grades(id)  ON DELETE CASCADE,
    total INTEGER     NOT NULL,
    feedback TEXT NOT NULL DEFAULT 'No feedback provided'  -- NOT NULL with meaningful default
);

CREATE INDEX ON feedbacks (grade_id);
CREATE INDEX ON feedbacks (standard_id);

-- Message tree for branching conversations (BCNF normalization)
-- Tracks parent-child relationships between messages for branching functionality
CREATE TABLE message_tree (
  parent_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  child_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id),
  CHECK (parent_id != child_id)  -- Prevent self-references
);

CREATE INDEX ON message_tree (parent_id);
CREATE INDEX ON message_tree (child_id);
CREATE INDEX ON message_tree (active);

-- Enforce single parent per child (tree structure, not DAG)
CREATE UNIQUE INDEX message_tree_one_parent_per_child ON message_tree(child_id) WHERE active = true;

-- Note: Crowdsourcing tables (simulation_chat_crowdsourced_feedbacks, simulation_crowdsourced_messages)
-- have been removed as part of BCNF migration