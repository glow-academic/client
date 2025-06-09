-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE simulations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  class_id   UUID        NULL REFERENCES classes(id) ON DELETE SET NULL, -- can be null for global simulations
  documents UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[],
  time_limit INTEGER     NULL,          -- in minutes, or no time limit
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- references scenarios
  rubric_id   UUID        NULL REFERENCES rubrics(id) ON DELETE SET NULL -- can be null if no rubric is used
);

CREATE TABLE simulation_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  user_id    UUID         NULL REFERENCES users(id)  ON DELETE CASCADE,
  class_id   UUID         NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  simulation_id    UUID        NOT NULL REFERENCES simulations(id)  ON DELETE CASCADE
);

CREATE TABLE simulation_chats (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  completed_at TIMESTAMPTZ  NULL,
  title      TEXT         NOT NULL,
  scenario_id UUID         NOT NULL REFERENCES scenarios(id)  ON DELETE CASCADE,
  attempt_id UUID         NOT NULL REFERENCES simulation_attempts(id)  ON DELETE CASCADE,
  completed  BOOLEAN      NOT NULL           DEFAULT FALSE
);

CREATE TABLE simulation_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  chat_id    UUID        NOT NULL REFERENCES simulation_chats(id)  ON DELETE CASCADE,
  query      TEXT        NOT NULL,
  response   TEXT        NOT NULL,
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

-- Insert Default Simulations (3 for the main agents)
INSERT INTO simulations (id, title, class_id, documents, time_limit, active, scenario_ids, rubric_id) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444444', 'Aggressive Student Practice', NULL, ARRAY[]::UUID[], NULL, true, ARRAY['aaaaaaaa-1111-2222-3333-444444444444']::UUID[], NULL),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'Happy Student Practice', NULL, ARRAY[]::UUID[], NULL, true, ARRAY['bbbbbbbb-1111-2222-3333-444444444444']::UUID[], NULL),
  ('cccccccc-1111-2222-3333-444444444444', 'Confused Student Practice', NULL, ARRAY[]::UUID[], NULL, true, ARRAY['cccccccc-1111-2222-3333-444444444444']::UUID[], NULL);

-- Insert Custom Randomized Simulations (3 additional diverse simulations)
INSERT INTO simulations (id, title, class_id, documents, time_limit, active, scenario_ids, rubric_id) VALUES
  ('c5a0b001-aaaa-bbbb-cccc-dddddddddddd', 'CS 180 Programming Challenge', '44444444-1111-1111-1111-111111111111', ARRAY[]::UUID[], 45, true, ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[], '11111111-1111-1111-1111-111111111111'),
  ('c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee', 'Multi-Course Algorithm Assessment', NULL, ARRAY[]::UUID[], 60, true, ARRAY['44444444-dddd-dddd-dddd-444444444444', '77777777-aaaa-bbbb-cccc-777777777777', '88888888-bbbb-cccc-dddd-888888888888', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa']::UUID[], '22222222-2222-2222-2222-222222222222'),
  ('c5a0b003-cccc-dddd-eeee-ffffffffffff', 'Advanced Theory Deep Dive', '77777777-4444-4444-4444-444444444444', ARRAY[]::UUID[], 90, true, ARRAY['bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', '99999999-cccc-dddd-eeee-999999999999']::UUID[], '22222222-2222-2222-2222-222222222222');

-- Insert Main Coding Practice Simulation
INSERT INTO simulations (id, title, documents, time_limit, active, scenario_ids) VALUES
  ('aaaaaaaa-bbbb-cccc-dddd-111111111111', 'Coding Practice Simulation', ARRAY[]::UUID[], 15, true, ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[])
ON CONFLICT (id) DO NOTHING;

-- Insert Simulation Attempts (Essential for linking chats to simulations and users)
INSERT INTO simulation_attempts (id, created_at, user_id, class_id, simulation_id) VALUES
  -- CS 180 attempts
  ('f1e2d3c4-b5a6-47f8-9e00-111111111111', NOW() - INTERVAL '2 hours', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-222222222222', NOW() - INTERVAL '1 day', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-1111-1111-1111-111111111111', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-333333333333', NOW() - INTERVAL '3 hours', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '44444444-1111-1111-1111-111111111111', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  
  -- CS 182 attempts
  ('f1e2d3c4-b5a6-47f8-9e00-444444444444', NOW() - INTERVAL '3 days', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-555555555555', NOW() - INTERVAL '6 hours', 'abcdef12-3456-7890-abcd-ef1234567890', '55555555-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-666666666666', NOW() - INTERVAL '5 hours', 'abcd1234-efab-cdef-abcd-123456abcdef', '55555555-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  
  -- CS 251 attempts
  ('f1e2d3c4-b5a6-47f8-9e00-777777777777', NOW() - INTERVAL '4 hours', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '66666666-3333-3333-3333-333333333333', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-888888888888', NOW() - INTERVAL '2 days', '87654321-dcba-fedc-baef-987654321cba', '66666666-3333-3333-3333-333333333333', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-999999999999', NOW() - INTERVAL '1 hour', 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', '66666666-3333-3333-3333-333333333333', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  
  -- CS 381 attempts
  ('f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa', NOW() - INTERVAL '6 hours', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '77777777-4444-4444-4444-444444444444', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb', NOW() - INTERVAL '5 hours', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-4444-4444-4444-444444444444', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-cccccccccccc', NOW() - INTERVAL '1 day', '12ab34cd-56ef-78ab-90cd-12ef34567890', '77777777-4444-4444-4444-444444444444', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  
  -- Custom simulation attempts
  ('c5a0b001-1111-2222-3333-444444444444', NOW() - INTERVAL '4 hours', 'c5180001-1111-2222-3333-444444444444', '44444444-1111-1111-1111-111111111111', 'c5a0b001-aaaa-bbbb-cccc-dddddddddddd'),
  ('c5a0b002-1111-2222-3333-444444444444', NOW() - INTERVAL '2 days', 'c5182001-2222-3333-4444-555555555555', '55555555-2222-2222-2222-222222222222', 'c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee'),
  ('c5a0b003-1111-2222-3333-444444444444', NOW() - INTERVAL '1 day', 'c5381001-4444-5555-6666-777777777777', '77777777-4444-4444-4444-444444444444', 'c5a0b003-cccc-dddd-eeee-ffffffffffff'),
  ('c5a0b004-1111-2222-3333-444444444444', NOW() - INTERVAL '3 hours', 'c5abc001-aaaa-bbbb-cccc-dddddddddddd', '44444444-1111-1111-1111-111111111111', 'c5a0b001-aaaa-bbbb-cccc-dddddddddddd'),
  ('c5a0b005-1111-2222-3333-444444444444', NOW() - INTERVAL '6 hours', 'c5abc002-aaaa-bbbb-cccc-dddddddddddd', '66666666-3333-3333-3333-333333333333', 'c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee'),
  ('c5a0b006-1111-2222-3333-444444444444', NOW() - INTERVAL '8 hours', 'c5abc003-aaaa-bbbb-cccc-dddddddddddd', '77777777-4444-4444-4444-444444444444', 'c5a0b003-cccc-dddd-eeee-ffffffffffff'),
  
  -- Additional attempts for guest mode testing (NULL user_id for guest attempts)
  ('aaaaaaaa-1111-2222-3333-444444444441', NOW() - INTERVAL '30 minutes', NULL, '44444444-1111-1111-1111-111111111111', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444442', NOW() - INTERVAL '2 days', NULL, '77777777-4444-4444-4444-444444444444', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444443', NOW() - INTERVAL '3 hours', NULL, '66666666-3333-3333-3333-333333333333', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444444', NOW() - INTERVAL '5 hours', NULL, '66666666-3333-3333-3333-333333333333', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444445', NOW() - INTERVAL '1 day', NULL, '55555555-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444446', NOW() - INTERVAL '6 hours', NULL, '77777777-4444-4444-4444-444444444444', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444447', NOW() - INTERVAL '4 days', NULL, '55555555-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444448', NOW() - INTERVAL '12 hours', NULL, '44444444-1111-1111-1111-111111111111', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444449', NOW() - INTERVAL '7 days', NULL, '77777777-4444-4444-4444-444444444444', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  ('aaaaaaaa-1111-2222-3333-444444444450', NOW() - INTERVAL '2 days', NULL, '55555555-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-cccc-dddd-111111111111'),
  
  -- Custom simulation guest attempts
  ('a5e5b001-1111-2222-3333-444444444444', NOW() - INTERVAL '1 hour', NULL, '44444444-1111-1111-1111-111111111111', 'c5a0b001-aaaa-bbbb-cccc-dddddddddddd'),
  ('a5e5b002-1111-2222-3333-444444444444', NOW() - INTERVAL '3 hours', NULL, '55555555-2222-2222-2222-222222222222', 'c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee'),
  ('a5e5b003-1111-2222-3333-444444444444', NOW() - INTERVAL '5 hours', NULL, '77777777-4444-4444-4444-444444444444', 'c5a0b003-cccc-dddd-eeee-ffffffffffff');

-- Insert Comprehensive Chat Data
INSERT INTO simulation_chats (id, created_at, completed_at, title, scenario_id, completed, attempt_id) VALUES
  -- CS 180 (Problem Solving And Object-Oriented Programming)
  ('f1e2d3c4-b5a6-47f8-9e00-111111111111', NOW() - INTERVAL '2 hours', NULL, 'NullPointer Exception', '11111111-aaaa-aaaa-aaaa-111111111111', false, 'f1e2d3c4-b5a6-47f8-9e00-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-222222222222', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'File I/O Issues', '22222222-bbbb-bbbb-bbbb-222222222222', true, 'f1e2d3c4-b5a6-47f8-9e00-222222222222'),
  ('f1e2d3c4-b5a6-47f8-9e00-333333333333', NOW() - INTERVAL '3 hours', NULL, 'Subclass Constructors', '33333333-cccc-cccc-cccc-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-333333333333'),

  -- CS 182 (Foundations Of Computer Science)  
  ('f1e2d3c4-b5a6-47f8-9e00-444444444444', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 'Proof by Induction', '44444444-dddd-dddd-dddd-444444444444', true, 'f1e2d3c4-b5a6-47f8-9e00-444444444444'),
  ('f1e2d3c4-b5a6-47f8-9e00-555555555555', NOW() - INTERVAL '6 hours', NULL, 'Pigeonhole Principle', '55555555-eeee-eeee-eeee-555555555555', false, 'f1e2d3c4-b5a6-47f8-9e00-555555555555'),
  ('f1e2d3c4-b5a6-47f8-9e00-666666666666', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', 'Finite Automata Diagram', '66666666-ffff-ffff-ffff-666666666666', true, 'f1e2d3c4-b5a6-47f8-9e00-666666666666'),

  -- CS 251 (Data Structures And Algorithms)
  ('f1e2d3c4-b5a6-47f8-9e00-777777777777', NOW() - INTERVAL '4 hours', NULL, 'Hash Table Collision', '77777777-aaaa-bbbb-cccc-777777777777', false, 'f1e2d3c4-b5a6-47f8-9e00-777777777777'),
  ('f1e2d3c4-b5a6-47f8-9e00-888888888888', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Dijkstra Implementation', '88888888-bbbb-cccc-dddd-888888888888', true, 'f1e2d3c4-b5a6-47f8-9e00-888888888888'),
  ('f1e2d3c4-b5a6-47f8-9e00-999999999999', NOW() - INTERVAL '1 hour', NULL, 'Recursive Tree Traversal', '99999999-cccc-dddd-eeee-999999999999', false, 'f1e2d3c4-b5a6-47f8-9e00-999999999999'),

  -- CS 381 (Introduction To The Analysis Of Algorithms)
  ('f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', 'Recurrence Relations', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', true, 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
  ('f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb', NOW() - INTERVAL '5 hours', NULL, 'NP-Completeness', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', false, 'f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb'),
  ('f1e2d3c4-b5a6-47f8-9e00-cccccccccccc', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Dynamic Programming', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', true, 'f1e2d3c4-b5a6-47f8-9e00-cccccccccccc'),

  -- Custom simulation chats
  ('c5a0b001-aaaa-bbbb-cccc-111111111111', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 'Programming Challenge - NullPointer', '11111111-aaaa-aaaa-aaaa-111111111111', true, 'c5a0b001-1111-2222-3333-444444444444'),
  ('c5a0b002-aaaa-bbbb-cccc-222222222222', NOW() - INTERVAL '2 days', NULL, 'Multi-Course Assessment - Proof', '44444444-dddd-dddd-dddd-444444444444', false, 'c5a0b002-1111-2222-3333-444444444444'),
  ('c5a0b003-aaaa-bbbb-cccc-333333333333', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', 'Theory Deep Dive - NP Complete', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', true, 'c5a0b003-1111-2222-3333-444444444444'),
  ('c5a0b004-aaaa-bbbb-cccc-444444444444', NOW() - INTERVAL '3 hours', NULL, 'Programming Challenge - File I/O', '22222222-bbbb-bbbb-bbbb-222222222222', false, 'c5a0b004-1111-2222-3333-444444444444'),
  ('c5a0b005-aaaa-bbbb-cccc-555555555555', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours', 'Multi-Course - Hash Tables', '77777777-aaaa-bbbb-cccc-777777777777', true, 'c5a0b005-1111-2222-3333-444444444444'),
  ('c5a0b006-aaaa-bbbb-cccc-666666666666', NOW() - INTERVAL '8 hours', NULL, 'Theory Deep Dive - Dynamic Programming', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', false, 'c5a0b006-1111-2222-3333-444444444444');

-- Additional sample chat data for testing
INSERT INTO simulation_chats (id, created_at, completed_at, title, scenario_id, completed, attempt_id) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444441', NOW() - INTERVAL '30 minutes', NULL, 'Infinite Loop', '11111111-aaaa-aaaa-aaaa-111111111111', false, 'aaaaaaaa-1111-2222-3333-444444444441'),
  ('aaaaaaaa-1111-2222-3333-444444444442', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Master Theorem Edge Case', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', true, 'aaaaaaaa-1111-2222-3333-444444444442'),
  ('aaaaaaaa-1111-2222-3333-444444444443', NOW() - INTERVAL '3 hours', NULL, 'Balancing BST', '99999999-cccc-dddd-eeee-999999999999', false, 'aaaaaaaa-1111-2222-3333-444444444443'),
  ('aaaaaaaa-1111-2222-3333-444444444444', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours', 'Adjacency List', '77777777-aaaa-bbbb-cccc-777777777777', true, 'aaaaaaaa-1111-2222-3333-444444444444'),
  ('aaaaaaaa-1111-2222-3333-444444444445', NOW() - INTERVAL '1 day', NULL, 'Set Theory Paradox', '44444444-dddd-dddd-dddd-444444444444', false, 'aaaaaaaa-1111-2222-3333-444444444445'),
  
  -- Guest simulation chats
  ('a5e5b001-aaaa-bbbb-cccc-111111111111', NOW() - INTERVAL '1 hour', NULL, 'Guest Programming Challenge', '11111111-aaaa-aaaa-aaaa-111111111111', false, 'a5e5b001-1111-2222-3333-444444444444'),
  ('a5e5b002-aaaa-bbbb-cccc-222222222222', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 'Guest Multi-Course Test', '44444444-dddd-dddd-dddd-444444444444', true, 'a5e5b002-1111-2222-3333-444444444444'),
  ('a5e5b003-aaaa-bbbb-cccc-333333333333', NOW() - INTERVAL '5 hours', NULL, 'Guest Theory Challenge', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', false, 'a5e5b003-1111-2222-3333-444444444444');

-- Insert Simulation Chat Rubrics (Custom rubric grades for each simulation chat)
INSERT INTO simulation_chat_grades (id, passed, score, time_taken, rubric_id, simulation_chat_id) VALUES
  -- CS 180 chats
  ('bbbb0001-1111-2222-3333-444444444444', true, 78, 1400, '11111111-1111-1111-1111-111111111111', 'f1e2d3c4-b5a6-47f8-9e00-111111111111'),
  ('bbbb0002-1111-2222-3333-444444444444', true, 82, 1600, '22222222-2222-2222-2222-222222222222', 'f1e2d3c4-b5a6-47f8-9e00-222222222222'),
  ('bbbb0003-1111-2222-3333-444444444444', false, 68, 1100, '11111111-1111-1111-1111-111111111111', 'f1e2d3c4-b5a6-47f8-9e00-333333333333'),
  
  -- CS 182 chats
  ('bbbb0004-1111-2222-3333-444444444444', true, 91, 1750, '22222222-2222-2222-2222-222222222222', 'f1e2d3c4-b5a6-47f8-9e00-444444444444'),
  ('bbbb0005-1111-2222-3333-444444444444', true, 74, 1250, '11111111-1111-1111-1111-111111111111', 'f1e2d3c4-b5a6-47f8-9e00-555555555555'),
  ('bbbb0006-1111-2222-3333-444444444444', true, 86, 1550, '22222222-2222-2222-2222-222222222222', 'f1e2d3c4-b5a6-47f8-9e00-666666666666'),
  
  -- CS 251 chats
  ('bbbb0007-1111-2222-3333-444444444444', false, 63, 950, '11111111-1111-1111-1111-111111111111', 'f1e2d3c4-b5a6-47f8-9e00-777777777777'),
  ('bbbb0008-1111-2222-3333-444444444444', true, 89, 1650, '22222222-2222-2222-2222-222222222222', 'f1e2d3c4-b5a6-47f8-9e00-888888888888'),
  ('bbbb0009-1111-2222-3333-444444444444', true, 77, 1300, '11111111-1111-1111-1111-111111111111', 'f1e2d3c4-b5a6-47f8-9e00-999999999999'),
  
  -- CS 381 chats
  ('bbbb0010-1111-2222-3333-444444444444', true, 84, 1450, '22222222-2222-2222-2222-222222222222', 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
  ('bbbb0011-1111-2222-3333-444444444444', false, 66, 1050, '11111111-1111-1111-1111-111111111111', 'f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb'),
  ('bbbb0012-1111-2222-3333-444444444444', true, 93, 1800, '22222222-2222-2222-2222-222222222222', 'f1e2d3c4-b5a6-47f8-9e00-cccccccccccc'),
  
  -- Custom simulation chats
  ('bbbb0013-1111-2222-3333-444444444444', true, 80, 1350, '11111111-1111-1111-1111-111111111111', 'c5a0b001-aaaa-bbbb-cccc-111111111111'),
  ('bbbb0014-1111-2222-3333-444444444444', true, 87, 1500, '22222222-2222-2222-2222-222222222222', 'c5a0b002-aaaa-bbbb-cccc-222222222222'),
  ('bbbb0015-1111-2222-3333-444444444444', true, 75, 1200, '11111111-1111-1111-1111-111111111111', 'c5a0b003-aaaa-bbbb-cccc-333333333333'),
  ('bbbb0016-1111-2222-3333-444444444444', false, 69, 1000, '22222222-2222-2222-2222-222222222222', 'c5a0b004-aaaa-bbbb-cccc-444444444444'),
  ('bbbb0017-1111-2222-3333-444444444444', true, 81, 1400, '11111111-1111-1111-1111-111111111111', 'c5a0b005-aaaa-bbbb-cccc-555555555555'),
  ('bbbb0018-1111-2222-3333-444444444444', true, 88, 1600, '22222222-2222-2222-2222-222222222222', 'c5a0b006-aaaa-bbbb-cccc-666666666666'),
  
  -- Additional sample chats
  ('bbbb0019-1111-2222-3333-444444444444', true, 79, 1300, '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-2222-3333-444444444441'),
  ('bbbb0020-1111-2222-3333-444444444444', true, 85, 1450, '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-1111-2222-3333-444444444442'),
  ('bbbb0021-1111-2222-3333-444444444444', false, 64, 900, '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-2222-3333-444444444443'),
  ('bbbb0022-1111-2222-3333-444444444444', true, 90, 1700, '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-1111-2222-3333-444444444444'),
  ('bbbb0023-1111-2222-3333-444444444444', true, 76, 1250, '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-2222-3333-444444444445'),
  
  -- Guest simulation chats
  ('bbbb0024-1111-2222-3333-444444444444', true, 83, 1400, '22222222-2222-2222-2222-222222222222', 'a5e5b001-aaaa-bbbb-cccc-111111111111'),
  ('bbbb0025-1111-2222-3333-444444444444', true, 72, 1150, '11111111-1111-1111-1111-111111111111', 'a5e5b002-aaaa-bbbb-cccc-222222222222'),
  ('bbbb0026-1111-2222-3333-444444444444', false, 67, 1050, '22222222-2222-2222-2222-222222222222', 'a5e5b003-aaaa-bbbb-cccc-333333333333');

-- Insert Sample Simulation Chat Feedbacks (showing detailed grading breakdown)
INSERT INTO simulation_chat_feedbacks (id, standard_id, simulation_chat_grade_id, total, feedback) VALUES
  -- Standards for bbbb0001 (AI Student rubric)
  ('cccc0001-1111-2222-3333-444444444444', '11111111-aaaa-bbbb-cccc-111111111111', 'bbbb0001-1111-2222-3333-444444444444', 10, 'Excellent consistency in aggressive personality - used caps and exclamation points effectively'),
  ('cccc0002-1111-2222-3333-444444444444', '33333333-aaaa-bbbb-cccc-111111111111', 'bbbb0001-1111-2222-3333-444444444444', 13, 'Showed realistic learning progression from confusion to understanding'),
  ('cccc0003-1111-2222-3333-444444444444', '55555555-aaaa-bbbb-cccc-111111111111', 'bbbb0001-1111-2222-3333-444444444444', 14, 'Asked highly relevant questions about NullPointerException debugging'),
  
  -- Standards for bbbb0002 (AI Teacher rubric)
  ('cccc0004-1111-2222-3333-444444444444', 'aaaaaaaa-1111-2222-3333-222222222222', 'bbbb0002-1111-2222-3333-444444444444', 14, 'Excellent use of Socratic questioning to guide student discovery'),
  ('cccc0005-1111-2222-3333-444444444444', 'cccccccc-1111-2222-3333-222222222222', 'bbbb0002-1111-2222-3333-444444444444', 15, 'All technical information was accurate and well-explained'),
  ('cccc0006-1111-2222-3333-444444444444', 'eeeeeeee-1111-2222-3333-222222222222', 'bbbb0002-1111-2222-3333-444444444444', 11, 'Clear communication but could be more concise'),
  
  -- Standards for bbbb0003 (AI Student rubric - failed example)
  ('cccc0007-1111-2222-3333-444444444444', '22222222-aaaa-bbbb-cccc-111111111111', 'bbbb0003-1111-2222-3333-444444444444', 8, 'Emotional responses were somewhat inconsistent with confused personality'),
  ('cccc0008-1111-2222-3333-444444444444', '44444444-aaaa-bbbb-cccc-111111111111', 'bbbb0003-1111-2222-3333-444444444444', 6, 'Mistakes seemed too advanced for freshman level student'),
  
  -- Standards for bbbb0004 (AI Teacher rubric)
  ('cccc0009-1111-2222-3333-444444444444', 'bbbbbbbb-1111-2222-3333-222222222222', 'bbbb0004-1111-2222-3333-444444444444', 12, 'Good scaffolding approach, helped student build understanding step by step'),
  ('cccc0010-1111-2222-3333-444444444444', 'ffffffff-1111-2222-3333-222222222222', 'bbbb0004-1111-2222-3333-444444444444', 10, 'Adapted communication style well to confused student personality'),
  
  -- Standards for bbbb0011 (AI Student rubric - failed example)
  ('cccc0011-1111-2222-3333-444444444444', '77777777-aaaa-bbbb-cccc-111111111111', 'bbbb0011-1111-2222-3333-444444444444', 8, 'Engagement level was inconsistent throughout the conversation'),
  ('cccc0012-1111-2222-3333-444444444444', '66666666-aaaa-bbbb-cccc-111111111111', 'bbbb0011-1111-2222-3333-444444444444', 7, 'Questions were sometimes too shallow for the complexity of the topic');