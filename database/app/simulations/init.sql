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
  time_limit INTEGER     NULL,          -- in minutes, or no time limit
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  rubric_id   UUID        NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  default_simulation  BOOLEAN     NOT NULL           DEFAULT FALSE,
  practice_simulation  BOOLEAN     NOT NULL           DEFAULT FALSE,
  department_id   UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  -- New simulation flags (BCNF normalization - moved from persona level)
  output_guardrail_active BOOLEAN NOT NULL DEFAULT FALSE,
  input_guardrail_active  BOOLEAN NOT NULL DEFAULT FALSE,
  image_input_active      BOOLEAN NOT NULL DEFAULT FALSE,
  hints_enabled           BOOLEAN NOT NULL DEFAULT FALSE
);

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

-- Simulation tags (ordered, BCNF)
CREATE TABLE simulation_tags (
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  idx           INT  NOT NULL,
  tag           TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, idx)
);

CREATE INDEX ON simulation_tags (simulation_id);

-- Prevent duplicate tag text within a simulation (case-insensitive)
CREATE UNIQUE INDEX simulation_tags_unique_text_per_sim
  ON simulation_tags (simulation_id, lower(tag));

-- Fast lookups by tag text within a simulation
CREATE INDEX simulation_tags_text_idx
  ON simulation_tags (simulation_id, lower(tag));

-- Link documents & parameter items to simulation tags (composite FK)
CREATE TABLE simulation_tag_documents (
  simulation_id UUID NOT NULL,
  tag_idx       INT  NOT NULL,
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, tag_idx, document_id),
  CONSTRAINT simulation_tag_documents_tag_fk
    FOREIGN KEY (simulation_id, tag_idx)
    REFERENCES simulation_tags(simulation_id, idx)
    ON DELETE CASCADE
);

CREATE TABLE simulation_tag_parameter_items (
  simulation_id     UUID NOT NULL,
  tag_idx           INT  NOT NULL,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, tag_idx, parameter_item_id),
  CONSTRAINT simulation_tag_parameter_items_tag_fk
    FOREIGN KEY (simulation_id, tag_idx)
    REFERENCES simulation_tags(simulation_id, idx)
    ON DELETE CASCADE
);

CREATE INDEX ON simulation_tag_documents (document_id);
CREATE INDEX ON simulation_tag_parameter_items (parameter_item_id);
CREATE INDEX ON simulation_tag_documents (simulation_id, tag_idx);
CREATE INDEX ON simulation_tag_parameter_items (simulation_id, tag_idx);

-- Convenience views for cross-simulation tag discovery
CREATE OR REPLACE VIEW v_tagged_documents AS
SELECT st.simulation_id, st.tag, std.document_id, d.name AS document_name
FROM simulation_tags st
JOIN simulation_tag_documents std
  ON std.simulation_id = st.simulation_id AND std.tag_idx = st.idx
JOIN documents d ON d.id = std.document_id;

CREATE OR REPLACE VIEW v_tagged_parameter_items AS
SELECT st.simulation_id, st.tag, stpi.parameter_item_id, pi.name AS parameter_item_name
FROM simulation_tags st
JOIN simulation_tag_parameter_items stpi
  ON stpi.simulation_id = st.simulation_id AND stpi.tag_idx = st.idx
JOIN parameter_items pi ON pi.id = stpi.parameter_item_id;

CREATE TABLE simulation_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  simulation_id    UUID        NOT NULL REFERENCES simulations(id)  ON DELETE CASCADE,
  infinite_mode BOOLEAN     NOT NULL           DEFAULT FALSE,
  infinite_mode_time_limit INTEGER     NULL, -- in minutes, or no time limit
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
  completed_at TIMESTAMPTZ  NULL,
  title      TEXT         NOT NULL,
  scenario_id UUID         NOT NULL REFERENCES scenarios(id)  ON DELETE CASCADE,
  attempt_id UUID         NOT NULL REFERENCES simulation_attempts(id)  ON DELETE CASCADE,
  completed  BOOLEAN      NOT NULL           DEFAULT FALSE,
  trace_id   TEXT         NULL -- openai trace id
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

CREATE TABLE simulation_hints (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  hint TEXT        NOT NULL,
  simulation_message_id UUID        NOT NULL REFERENCES simulation_messages(id)  ON DELETE CASCADE
);

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
    feedback TEXT
  );

-- Note: Crowdsourcing tables (simulation_chat_crowdsourced_feedbacks, simulation_crowdsourced_messages)
-- have been removed as part of BCNF migration