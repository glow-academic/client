-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE simulation_message_type AS ENUM ('query', 'response'); -- query or response

CREATE TABLE simulations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT 'No description provided',
  -- time_limit moved to simulation_time_limits junction table (absence = infinite)
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  rubric_id   UUID        NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  practice_simulation  BOOLEAN     NOT NULL           DEFAULT FALSE,
  -- New simulation flags (BCNF normalization - moved from persona level)
  output_guardrail_active BOOLEAN NOT NULL DEFAULT FALSE,
  input_guardrail_active  BOOLEAN NOT NULL DEFAULT FALSE,
  image_input_active      BOOLEAN NOT NULL DEFAULT FALSE,
  hints_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  objectives_enabled      BOOLEAN NOT NULL DEFAULT TRUE
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

-- Simulation → Scenarios junction table with ordering
CREATE TABLE simulation_scenarios (
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  scenario_id   UUID NOT NULL REFERENCES scenarios(id)   ON DELETE CASCADE,
  position      INT  NOT NULL DEFAULT 1,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, scenario_id)
);

CREATE INDEX ON simulation_scenarios (simulation_id);
CREATE INDEX ON simulation_scenarios (scenario_id);

-- Enforce unique ordering within each simulation
CREATE UNIQUE INDEX simulation_scenarios_position_uniq
  ON simulation_scenarios(simulation_id, position);

-- Simulation time limits junction table (BCNF normalization)
-- Logic: If record exists -> use time limit, if no record -> infinite/no time limit
-- For attempts: simulation_attempts.infinite_mode flag determines if time limits apply
CREATE TABLE simulation_time_limits (
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (simulation_id)
);

CREATE INDEX ON simulation_time_limits (simulation_id);

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

CREATE TABLE simulation_chats (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  -- completed_at removed (use simulation_chat_grades.time_taken as source of truth)
  title      TEXT         NOT NULL,
  scenario_id UUID         NOT NULL REFERENCES scenarios(id)  ON DELETE CASCADE,
  attempt_id UUID         NOT NULL REFERENCES simulation_attempts(id)  ON DELETE CASCADE,
  completed  BOOLEAN      NOT NULL           DEFAULT FALSE,
  trace_id   TEXT         NOT NULL -- openai trace id (NOT NULL, no default)
);

CREATE TABLE simulation_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  chat_id    UUID        NOT NULL REFERENCES simulation_chats(id)  ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  type  simulation_message_type NOT NULL, -- query or response
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE
);

-- Simulation hints collection table (BCNF normalization)
-- Normalized text collection pattern: composite PK with idx, created_at only (matches scenario_objectives)
CREATE TABLE simulation_hints (
  simulation_message_id UUID NOT NULL REFERENCES simulation_messages(id) ON DELETE CASCADE,
  idx               INT  NOT NULL,
  hint              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (simulation_message_id, idx)
);

CREATE INDEX ON simulation_hints (simulation_message_id);

CREATE TABLE simulation_chat_grades (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    description TEXT        NOT NULL DEFAULT 'No description provided',
    passed     BOOLEAN     NOT NULL,
    score      INTEGER     NOT NULL,
    time_taken INTEGER     NOT NULL, -- in seconds
    rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE,
    simulation_chat_id   UUID        NOT NULL REFERENCES simulation_chats(id)  ON DELETE CASCADE
  );

  CREATE TABLE simulation_chat_feedbacks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    standard_id   UUID        NOT NULL REFERENCES standards(id)  ON DELETE CASCADE,
    simulation_chat_grade_id   UUID        NOT NULL REFERENCES simulation_chat_grades(id)  ON DELETE CASCADE,
    total INTEGER     NOT NULL,
    feedback TEXT NOT NULL DEFAULT 'No feedback provided'  -- NOT NULL with meaningful default
  );

-- Note: Crowdsourcing tables (simulation_chat_crowdsourced_feedbacks, simulation_crowdsourced_messages)
-- have been removed as part of BCNF migration