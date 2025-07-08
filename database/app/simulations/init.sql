-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE simulation_message_type AS ENUM ('query', 'response'); -- query or response

CREATE TABLE cohorts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NULL,
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  profile_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[] -- references profiles
);

CREATE TABLE simulations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  time_limit INTEGER     NULL,          -- in minutes, or no time limit
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- references scenarios
  cohort_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- references cohorts
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
  audio     BOOLEAN     NOT NULL           DEFAULT FALSE,
  file_path  TEXT        NULL, -- if this has a corresponding audio file, this will be the path to the audio file
  type  simulation_message_type NOT NULL, -- query or response
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE
);

CREATE TABLE simulation_sketches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  chat_id    UUID        NOT NULL REFERENCES simulation_chats(id)  ON DELETE CASCADE,
  file_path  TEXT        NOT NULL
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
INSERT INTO simulations (id, title, description, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aggressive Practice', 'Practice simulation for handling aggressive student interactions', '1a19da05-aaaa-bbbb-cccc-555555555555', NULL, ARRAY['aaaaaaaa-1111-2222-3333-444444444444']::UUID[], true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Happy Practice', 'Practice simulation for handling happy student interactions', '1a19da05-aaaa-bbbb-cccc-555555555555', NULL, ARRAY['bbbbbbbb-1111-2222-3333-444444444444']::UUID[], true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Confused Practice', 'Practice simulation for handling confused student interactions', '1a19da05-aaaa-bbbb-cccc-555555555555', NULL, ARRAY['cccccccc-1111-2222-3333-444444444444']::UUID[], true);

-- ============================================================================
-- FALL 2025 W1 TRAINING (BEGINNER) SIMULATIONS
-- ============================================================================

INSERT INTO simulations (id, title, description, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f25w1b-s01-aaaa-bbbb-cccc-dddddddd', 'Basic Student Interaction - Arrays', 'Practice fundamental student interaction skills while helping with array-related programming concepts. Focus on building confidence with basic tutoring scenarios.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w1b01-aaaa-bbbb-cccc-111111111111', 'f25w1b02-aaaa-bbbb-cccc-222222222222', 'f25w1b03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f25w1b-s02-aaaa-bbbb-cccc-dddddddd', 'Handling Confused Students - Loops', 'Develop skills for working with confused students while covering loop concepts. Learn to break down complex problems into manageable steps.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w1b04-aaaa-bbbb-cccc-444444444444', 'f25w1b05-aaaa-bbbb-cccc-555555555555', 'f25w1b06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f25w1b-s03-aaaa-bbbb-cccc-dddddddd', 'Time Management Practice - File I/O', 'Practice managing time effectively while helping students with file input/output concepts. Balance thoroughness with efficiency.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w1b07-aaaa-bbbb-cccc-777777777777', 'f25w1b08-aaaa-bbbb-cccc-888888888888', 'f25w1b09-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W1 TRAINING (ADVANCED) SIMULATIONS
-- ============================================================================

INSERT INTO simulations (id, title, description, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f25w1a-s01-aaaa-bbbb-cccc-dddddddd', 'Graph Theory Tutoring - DFS/BFS', 'Handle challenging graph theory concepts with potentially frustrated students. Practice de-escalation while maintaining technical accuracy.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w1a01-aaaa-bbbb-cccc-111111111111', 'f25w1a02-aaaa-bbbb-cccc-222222222222', 'f25w1a03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f25w1a-s02-aaaa-bbbb-cccc-dddddddd', 'Mathematical Induction Practice', 'Guide students through complex mathematical induction problems. Develop skills for handling abstract mathematical concepts with struggling students.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w1a04-aaaa-bbbb-cccc-444444444444', 'f25w1a05-aaaa-bbbb-cccc-555555555555', 'f25w1a06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f25w1a-s03-aaaa-bbbb-cccc-dddddddd', 'Advanced Data Structures - Trees', 'Work with advanced tree data structures while managing impatient or frustrated students. Practice maintaining composure under pressure.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w1a07-aaaa-bbbb-cccc-777777777777', 'f25w1a08-aaaa-bbbb-cccc-888888888888', 'f25w1a09-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W2 TRAINING (CS 1XX/2XX) SIMULATIONS - DOCUMENT BASED
-- ============================================================================

INSERT INTO simulations (id, title, description, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f25w2l-s01-aaaa-bbbb-cccc-dddddddd', 'Coding Project OOP', 'Help students with object-oriented programming projects using course documents. Practice referencing materials while maintaining student engagement.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w2l01-aaaa-bbbb-cccc-111111111111', 'f25w2l02-aaaa-bbbb-cccc-222222222222', 'f25w2l03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f25w2l-s02-aaaa-bbbb-cccc-dddddddd', 'Basic Induction & Proofs', 'Guide students through fundamental proof techniques using course materials. Develop skills for explaining abstract mathematical concepts clearly.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w2l04-aaaa-bbbb-cccc-444444444444', 'f25w2l05-aaaa-bbbb-cccc-555555555555', 'f25w2l06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f25w2l-s03-aaaa-bbbb-cccc-dddddddd', 'Data Structures and Algorithms', 'Work with students on fundamental data structures and algorithms using course documents. Practice balancing theory with practical implementation.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w2l07-aaaa-bbbb-cccc-777777777777', 'f25w2l08-aaaa-bbbb-cccc-888888888888', 'f25w2l09-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W2 TRAINING (CS 3XX/4XX) SIMULATIONS - DOCUMENT BASED
-- ============================================================================

INSERT INTO simulations (id, title, description, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f25w2h-s01-aaaa-bbbb-cccc-dddddddd', 'Analysis of Algorithms', 'Handle advanced algorithm analysis with upper-level students using course documents. Practice managing high-stakes academic pressure and complex theoretical concepts.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w2h01-aaaa-bbbb-cccc-111111111111', 'f25w2h02-aaaa-bbbb-cccc-222222222222', 'f25w2h03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f25w2h-s02-aaaa-bbbb-cccc-dddddddd', 'Networking', 'Support students with networking concepts and implementation using course materials. Develop skills for explaining complex systems concepts clearly.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w2h04-aaaa-bbbb-cccc-444444444444', 'f25w2h05-aaaa-bbbb-cccc-555555555555', 'f25w2h06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f25w2h-s03-aaaa-bbbb-cccc-dddddddd', 'Machine Learning', 'Guide students through machine learning concepts using course documents. Practice handling advanced mathematical concepts with potentially frustrated students.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w2h07-aaaa-bbbb-cccc-777777777777', 'f25w2h08-aaaa-bbbb-cccc-888888888888', 'f25w2h09-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 W3 COMMUNICATION TRAINING SIMULATIONS
-- ============================================================================

INSERT INTO simulations (id, title, description, rubric_id, time_limit, scenario_ids, default_simulation) VALUES
  ('f25w3c-s01-aaaa-bbbb-cccc-dddddddd', 'Campus Belonging & Identity', 'Address sensitive topics related to campus identity and belonging. Practice empathetic communication while maintaining professional boundaries.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w3c01-aaaa-bbbb-cccc-111111111111', 'f25w3c02-aaaa-bbbb-cccc-222222222222', 'f25w3c03-aaaa-bbbb-cccc-333333333333']::UUID[], false),
  ('f25w3c-s02-aaaa-bbbb-cccc-dddddddd', 'Academic Preparedness & Equity', 'Handle conversations about academic preparedness and equity issues. Develop skills for supportive communication with struggling students.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w3c04-aaaa-bbbb-cccc-444444444444', 'f25w3c05-aaaa-bbbb-cccc-555555555555', 'f25w3c06-aaaa-bbbb-cccc-666666666666']::UUID[], false),
  ('f25w3c-s03-aaaa-bbbb-cccc-dddddddd', 'Resource Awareness & Cultural Sensitivity', 'Navigate conversations about resource access and cultural sensitivity. Practice inclusive communication and appropriate referral techniques.', '1a19da05-aaaa-bbbb-cccc-555555555555', 900, ARRAY['f25w3c07-aaaa-bbbb-cccc-777777777777', 'f25w3c08-aaaa-bbbb-cccc-888888888888', 'f25w3c09-aaaa-bbbb-cccc-999999999999']::UUID[], false);

-- ============================================================================
-- FALL 2025 TRAINING COHORTS
-- ============================================================================

INSERT INTO cohorts (id, title, description, profile_ids, active) VALUES
  ('f25w1b-cohort-aaaa-bbbb-cccc-dddd', 'Fall 2025 W1 Training (Beginner)', 'Foundational TA training focusing on basic student interaction skills, handling confused students, and time management. Designed for new TAs with limited tutoring experience.',
   ARRAY[
     -- Instructors supervising CS 180 and CS 182 courses
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-bbbb-cccc-111111111111', '33333333-aaaa-bbbb-cccc-333333333333',
     -- New TAs for beginner training
     '1a001111-1111-1111-1111-111111111111', '1a001111-2222-2222-2222-222222222222', '1a001111-3333-3333-3333-333333333333', 
     '1a001111-4444-4444-4444-444444444444', '1a001111-5555-5555-5555-555555555555',
     -- Additional CS 180 TAs
     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'c5180001-1111-2222-3333-444444444444', 'c5180002-1111-2222-3333-444444444444', '99b90118-7b9e-4e12-8e81-d7ccc2916601'
   ]::UUID[], true),

  ('f25w1a-cohort-aaaa-bbbb-cccc-dddd', 'Fall 2025 W1 Training (Advanced)', 'Advanced TA training focusing on complex technical concepts, handling frustrated students, and maintaining composure under pressure. For experienced TAs ready for challenging scenarios.',
   ARRAY[
     -- Instructors supervising CS 251 and CS 381 courses
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-aaaa-bbbb-cccc-444444444444', '55555555-aaaa-bbbb-cccc-555555555555',
     -- Advanced TAs from CS 251 and CS 381
     'cccccccc-cccc-cccc-cccc-cccccccccccc', '87654321-dcba-fedc-baef-987654321cba', 'c5251001-3333-4444-5555-666666666666',
     '12ab34cd-56ef-78ab-90cd-12ef34567890', 'c5381001-4444-5555-6666-777777777777', 'c5381002-4444-5555-6666-777777777777',
     -- Multi-class experienced TAs
     'c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'c5abc004-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916610'
   ]::UUID[], true),

  ('f25w2l-cohort-aaaa-bbbb-cccc-dddd', 'Fall 2025 W2 Training (CS 1XX/2XX)', 'Document-based training for lower-level CS courses. Focus on using course materials effectively while maintaining student engagement and explaining foundational concepts clearly.',
   ARRAY[
     -- Instructors for CS 180, CS 182, and CS 251
     '11111111-aaaa-bbbb-cccc-111111111111', '22222222-aaaa-bbbb-cccc-222222222222', '33333333-aaaa-bbbb-cccc-333333333333',
     -- Week 2 training TAs
     '1a002222-1111-1111-1111-111111111111', '1a002222-2222-2222-2222-222222222222', '1a002222-3333-3333-3333-333333333333',
     '1a002222-5555-5555-5555-555555555555',
     -- TAs from CS 180, CS 182, and CS 251
     'abcdef12-3456-7890-abcd-ef1234567890', 'c5182001-2222-3333-4444-555555555555', 'c5182002-2222-3333-4444-555555555555',
     'c5251002-3333-4444-5555-666666666666', 'c5251003-3333-4444-5555-666666666666', 'c5abc001-aaaa-bbbb-cccc-dddddddddddd',
     'c5abc002-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916603', '99b90118-7b9e-4e12-8e81-d7ccc2916605'
   ]::UUID[], true),

  ('f25w2h-cohort-aaaa-bbbb-cccc-dddd', 'Fall 2025 W2 Training (CS 3XX/4XX)', 'Document-based training for upper-level CS courses. Advanced technical communication skills, handling high-stakes academic pressure, and complex theoretical concepts.',
   ARRAY[
     -- Instructors for advanced courses
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-aaaa-bbbb-cccc-222222222222', '55555555-aaaa-bbbb-cccc-555555555555',
     -- Week 2 advanced training TAs
     '1a002222-4444-4444-4444-444444444444',
     -- Advanced TAs from CS 381
     'c5381003-4444-5555-6666-777777777777', 'c5381004-4444-5555-6666-777777777777', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd',
     -- Multi-class advanced TAs
     'c5abc004-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916607', '99b90118-7b9e-4e12-8e81-d7ccc2916608',
     '99b90118-7b9e-4e12-8e81-d7ccc2916610'
   ]::UUID[], true),

  ('f25w3c-cohort-aaaa-bbbb-cccc-dddd', 'Fall 2025 W3 Communication Training', 'Specialized training for sensitive communication topics including campus belonging, academic equity, and cultural sensitivity. Essential skills for all TAs working with diverse student populations.',
   ARRAY[
     -- All instructors for comprehensive communication training
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-bbbb-cccc-111111111111', '22222222-aaaa-bbbb-cccc-222222222222',
     '33333333-aaaa-bbbb-cccc-333333333333', '44444444-aaaa-bbbb-cccc-444444444444', '55555555-aaaa-bbbb-cccc-555555555555',
     -- Instructional staff for communication expertise
     'a1bc0cb2-c9a2-4c80-8dd5-75156eb58ce1', 'b44a9d96-2b2e-4bcc-88e7-58cb6214aac1', 'c7c6f71a-2a4b-4e87-9320-4f444a603519',
     -- Week 3 specialized training TAs
     '1a003333-1111-1111-1111-111111111111', '1a003333-2222-2222-2222-222222222222', '1a003333-3333-3333-3333-333333333333',
     '1a003333-4444-4444-4444-444444444444', '1a003333-5555-5555-5555-555555555555',
     -- Representative TAs from all course levels
     'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'c5251004-3333-4444-5555-666666666666',
     '99b90118-7b9e-4e12-8e81-d7ccc2916604', '99b90118-7b9e-4e12-8e81-d7ccc2916606', '99b90118-7b9e-4e12-8e81-d7ccc2916609'
   ]::UUID[], true);

