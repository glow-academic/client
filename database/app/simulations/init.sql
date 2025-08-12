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
  scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- references scenarios
  rubric_id   UUID        NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  default_simulation  BOOLEAN     NOT NULL           DEFAULT FALSE,
  practice_simulation  BOOLEAN     NOT NULL           DEFAULT FALSE
);

CREATE TABLE simulation_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  profile_id    UUID         NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  simulation_id    UUID        NOT NULL REFERENCES simulations(id)  ON DELETE CASCADE,
  infinite_mode BOOLEAN     NOT NULL           DEFAULT FALSE,
  infinite_mode_time_limit INTEGER     NULL -- in minutes, or no time limit
);

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

CREATE TABLE simulation_chat_grades (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    description TEXT        NOT NULL DEFAULT 'No description provided',
    passed     BOOLEAN     NOT NULL,
    score      INTEGER     NOT NULL,
    time_taken INTEGER     NOT NULL, -- in seconds
    rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE,
    simulation_chat_id   UUID        NOT NULL REFERENCES simulation_chats(id)  ON DELETE CASCADE,
    checkpoints_reached BOOLEAN[] NOT NULL DEFAULT ARRAY[]::BOOLEAN[]
  );

  CREATE TABLE simulation_chat_feedbacks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    standard_id   UUID        NOT NULL REFERENCES standards(id)  ON DELETE CASCADE,
    simulation_chat_grade_id   UUID        NOT NULL REFERENCES simulation_chat_grades(id)  ON DELETE CASCADE,
    total INTEGER     NOT NULL,
    feedback TEXT
  );

  CREATE TABLE simulation_chat_crowdsourced_feedbacks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    profile_id   UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    simulation_chat_feedback_id   UUID        NOT NULL REFERENCES simulation_chat_feedbacks(id)  ON DELETE CASCADE,
    total INTEGER     NOT NULL,
    feedback TEXT
  );

  CREATE TABLE simulation_crowdsourced_messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    simulation_message_id   UUID        NOT NULL REFERENCES simulation_messages(id)  ON DELETE CASCADE,
    profile_id   UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    response BOOLEAN     NOT NULL
  );