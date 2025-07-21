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
  time_limit INTEGER     NULL,          -- in minutes, or no time limit
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- references scenarios
  rubric_id   UUID        NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  default_simulation  BOOLEAN     NOT NULL           DEFAULT FALSE
);

CREATE TABLE simulation_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  profile_id    UUID         NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  simulation_id    UUID        NOT NULL REFERENCES simulations(id)  ON DELETE CASCADE
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


-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert Default Practice Simulations (single focused for aggressive, happy, and confused)
INSERT INTO simulations (id, title, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aggressive Practice', '33333333-3333-3333-3333-333333333333', NULL, ARRAY['aaaaaaaa-1111-2222-3333-444444444444']::UUID[], true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Happy Practice', '33333333-3333-3333-3333-333333333333', NULL, ARRAY['bbbbbbbb-1111-2222-3333-444444444444']::UUID[], true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Confused Practice', '33333333-3333-3333-3333-333333333333', NULL, ARRAY['cccccccc-1111-2222-3333-444444444444']::UUID[], true);

-- ============================================================================
-- FALL 2025 W1 TRAINING (BEGINNER) SIMULATIONS
-- ============================================================================

INSERT INTO simulations (id, title, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f2511b01-aaaa-bbbb-cccc-dddddddddddd', 'Basic Student Interaction - Arrays', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2511b01-aaaa-bbbb-cccc-111111111111', 'f2511b02-aaaa-bbbb-cccc-222222222222', 'f2511b03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f2511b02-aaaa-bbbb-cccc-dddddddddddd', 'Handling Confused Students - Loops', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2511b04-aaaa-bbbb-cccc-444444444444', 'f2511b05-aaaa-bbbb-cccc-555555555555', 'f2511b06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f2511b03-aaaa-bbbb-cccc-dddddddddddd', 'Time Management Practice - File I/O', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2511b07-aaaa-bbbb-cccc-777777777777', 'f2511b08-aaaa-bbbb-cccc-888888888888', 'f2511b09-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W1 TRAINING (ADVANCED) SIMULATIONS
-- ============================================================================

INSERT INTO simulations (id, title, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f2511a01-aaaa-bbbb-cccc-dddddddddddd', 'Graph Theory Tutoring - DFS/BFS', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2511a01-aaaa-bbbb-cccc-111111111111', 'f2511a02-aaaa-bbbb-cccc-222222222222', 'f2511a03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f2511a02-aaaa-bbbb-cccc-dddddddddddd', 'Mathematical Induction Practice', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2511a04-aaaa-bbbb-cccc-444444444444', 'f2511a05-aaaa-bbbb-cccc-555555555555', 'f2511a06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f2511a03-aaaa-bbbb-cccc-dddddddddddd', 'Advanced Data Structures - Trees', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2511a07-aaaa-bbbb-cccc-777777777777', 'f2511a08-aaaa-bbbb-cccc-888888888888', 'f2511a09-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W2 TRAINING (CS 1XX/2XX) SIMULATIONS - DOCUMENT BASED
-- ============================================================================

INSERT INTO simulations (id, title, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f2522101-aaaa-bbbb-cccc-dddddddddddd', 'Coding Project OOP', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2522101-aaaa-bbbb-cccc-111111111111', 'f2522102-aaaa-bbbb-cccc-222222222222', 'f2522103-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f2522102-aaaa-bbbb-cccc-dddddddddddd', 'Basic Induction & Proofs', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2522104-aaaa-bbbb-cccc-444444444444', 'f2522105-aaaa-bbbb-cccc-555555555555', 'f2522106-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f2522103-aaaa-bbbb-cccc-dddddddddddd', 'Data Structures and Algorithms', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2522107-aaaa-bbbb-cccc-777777777777', 'f2522108-aaaa-bbbb-cccc-888888888888', 'f2522109-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W2 TRAINING (CS 3XX/4XX) SIMULATIONS - DOCUMENT BASED
-- ============================================================================

INSERT INTO simulations (id, title, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f2522201-aaaa-bbbb-cccc-dddddddddddd', 'Analysis of Algorithms', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2522201-aaaa-bbbb-cccc-111111111111', 'f2522202-aaaa-bbbb-cccc-222222222222', 'f2522203-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f2522202-aaaa-bbbb-cccc-dddddddddddd', 'Networking', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2522204-aaaa-bbbb-cccc-444444444444', 'f2522205-aaaa-bbbb-cccc-555555555555', 'f2522206-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f2522203-aaaa-bbbb-cccc-dddddddddddd', 'Machine Learning', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2522207-aaaa-bbbb-cccc-777777777777', 'f2522208-aaaa-bbbb-cccc-888888888888', 'f2522209-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W3 COMMUNICATION TRAINING SIMULATIONS
-- ============================================================================

INSERT INTO simulations (id, title, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f2533c01-aaaa-bbbb-cccc-dddddddddddd', 'Campus Belonging & Identity', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2533c01-aaaa-bbbb-cccc-111111111111', 'f2533c02-aaaa-bbbb-cccc-222222222222', 'f2533c03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f2533c02-aaaa-bbbb-cccc-dddddddddddd', 'Academic Preparedness & Equity', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2533c04-aaaa-bbbb-cccc-444444444444', 'f2533c05-aaaa-bbbb-cccc-555555555555', 'f2533c06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f2533c03-aaaa-bbbb-cccc-dddddddddddd', 'Cultural & Resource Awareness', '33333333-3333-3333-3333-333333333333', 15, ARRAY['f2533c07-aaaa-bbbb-cccc-777777777777', 'f2533c08-aaaa-bbbb-cccc-888888888888', 'f2533c09-aaaa-bbbb-cccc-999999999999']::UUID[], false);