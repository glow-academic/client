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
  time_limit INTEGER     NULL,          -- in minutes, or no time limit
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- references scenarios
  rubric_id   UUID        NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE
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
INSERT INTO simulations (id, title, class_id, time_limit, active, scenario_ids, rubric_id) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444444', 'Aggressive Student Practice', NULL, NULL, true, ARRAY['aaaaaaaa-1111-2222-3333-444444444444']::UUID[], '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'Happy Student Practice', NULL, NULL, true, ARRAY['bbbbbbbb-1111-2222-3333-444444444444']::UUID[], '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-1111-2222-3333-444444444444', 'Confused Student Practice', NULL, NULL, true, ARRAY['cccccccc-1111-2222-3333-444444444444']::UUID[], '33333333-3333-3333-3333-333333333333');

-- Insert Custom Randomized Simulations (3 additional diverse simulations)
INSERT INTO simulations (id, title, class_id, time_limit, active, scenario_ids, rubric_id) VALUES
  ('c5a0b001-aaaa-bbbb-cccc-dddddddddddd', 'CS 180 Programming Challenge', '44444444-1111-1111-1111-111111111111', 45, true, ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[], '33333333-3333-3333-3333-333333333333'),
  ('c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee', 'Multi-Course Algorithm Assessment', NULL, 60, true, ARRAY['44444444-dddd-dddd-dddd-444444444444', '77777777-aaaa-bbbb-cccc-777777777777', '88888888-bbbb-cccc-dddd-888888888888', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa']::UUID[], '33333333-3333-3333-3333-333333333333'),
  ('c5a0b003-cccc-dddd-eeee-ffffffffffff', 'Advanced Theory Deep Dive', '77777777-4444-4444-4444-444444444444', 90, true, ARRAY['bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', '99999999-cccc-dddd-eeee-999999999999']::UUID[], '33333333-3333-3333-3333-333333333333');

-- Insert Main Coding Practice Simulation
INSERT INTO simulations (id, title, time_limit, active, scenario_ids, rubric_id) VALUES
  ('aaaaaaaa-bbbb-cccc-dddd-111111111111', 'Coding Practice Simulation', 15, true, ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[], '33333333-3333-3333-3333-333333333333')
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
  ('bbbb0001-1111-2222-3333-444444444444', true, 78, 1400, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-111111111111'),
  ('bbbb0002-1111-2222-3333-444444444444', true, 82, 1600, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-222222222222'),
  ('bbbb0003-1111-2222-3333-444444444444', false, 68, 1100, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-333333333333'),
  
  -- CS 182 chats
  ('bbbb0004-1111-2222-3333-444444444444', true, 91, 1750, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-444444444444'),
  ('bbbb0005-1111-2222-3333-444444444444', true, 74, 1250, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-555555555555'),
  ('bbbb0006-1111-2222-3333-444444444444', true, 86, 1550, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-666666666666'),
  
  -- CS 251 chats
  ('bbbb0007-1111-2222-3333-444444444444', false, 63, 950, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-777777777777'),
  ('bbbb0008-1111-2222-3333-444444444444', true, 89, 1650, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-888888888888'),
  ('bbbb0009-1111-2222-3333-444444444444', true, 77, 1300, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-999999999999'),
  
  -- CS 381 chats
  ('bbbb0010-1111-2222-3333-444444444444', true, 84, 1450, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
  ('bbbb0011-1111-2222-3333-444444444444', false, 66, 1050, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb'),
  ('bbbb0012-1111-2222-3333-444444444444', true, 93, 1800, '33333333-3333-3333-3333-333333333333', 'f1e2d3c4-b5a6-47f8-9e00-cccccccccccc'),
  
  -- Custom simulation chats
  ('bbbb0013-1111-2222-3333-444444444444', true, 80, 1350, '33333333-3333-3333-3333-333333333333', 'c5a0b001-aaaa-bbbb-cccc-111111111111'),
  ('bbbb0014-1111-2222-3333-444444444444', true, 87, 1500, '33333333-3333-3333-3333-333333333333', 'c5a0b002-aaaa-bbbb-cccc-222222222222'),
  ('bbbb0015-1111-2222-3333-444444444444', true, 75, 1200, '33333333-3333-3333-3333-333333333333', 'c5a0b003-aaaa-bbbb-cccc-333333333333'),
  ('bbbb0016-1111-2222-3333-444444444444', false, 69, 1000, '33333333-3333-3333-3333-333333333333', 'c5a0b004-aaaa-bbbb-cccc-444444444444'),
  ('bbbb0017-1111-2222-3333-444444444444', true, 81, 1400, '33333333-3333-3333-3333-333333333333', 'c5a0b005-aaaa-bbbb-cccc-555555555555'),
  ('bbbb0018-1111-2222-3333-444444444444', true, 88, 1600, '33333333-3333-3333-3333-333333333333', 'c5a0b006-aaaa-bbbb-cccc-666666666666'),
  
  -- Additional sample chats
  ('bbbb0019-1111-2222-3333-444444444444', true, 79, 1300, '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-1111-2222-3333-444444444441'),
  ('bbbb0020-1111-2222-3333-444444444444', true, 85, 1450, '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-1111-2222-3333-444444444442'),
  ('bbbb0021-1111-2222-3333-444444444444', false, 64, 900, '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-1111-2222-3333-444444444443'),
  ('bbbb0022-1111-2222-3333-444444444444', true, 90, 1700, '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-1111-2222-3333-444444444444'),
  ('bbbb0023-1111-2222-3333-444444444444', true, 76, 1250, '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-1111-2222-3333-444444444445'),
  
  -- Guest simulation chats
  ('bbbb0024-1111-2222-3333-444444444444', true, 83, 1400, '33333333-3333-3333-3333-333333333333', 'a5e5b001-aaaa-bbbb-cccc-111111111111'),
  ('bbbb0025-1111-2222-3333-444444444444', true, 72, 1150, '33333333-3333-3333-3333-333333333333', 'a5e5b002-aaaa-bbbb-cccc-222222222222'),
  ('bbbb0026-1111-2222-3333-444444444444', false, 67, 1050, '33333333-3333-3333-3333-333333333333', 'a5e5b003-aaaa-bbbb-cccc-333333333333');

-- Insert Sample Simulation Chat Feedbacks (showing detailed grading breakdown)
INSERT INTO simulation_chat_feedbacks (id, standard_id, simulation_chat_grade_id, total, feedback) VALUES
  -- Standards for bbbb0001 (Teaching Assistant Evaluation Rubric)
  ('cccc0001-1111-2222-3333-444444444444', '11111111-2222-aaaa-bbbb-333333333333', 'bbbb0001-1111-2222-3333-444444444444', 4, 'Good use of guided questioning to help student understand NullPointerException'),
  ('cccc0002-1111-2222-3333-444444444444', '22222222-2222-aaaa-bbbb-333333333333', 'bbbb0001-1111-2222-3333-444444444444', 4, 'Demonstrated solid understanding of Java concepts and debugging techniques'),
  ('cccc0003-1111-2222-3333-444444444444', '33333333-2222-aaaa-bbbb-333333333333', 'bbbb0001-1111-2222-3333-444444444444', 4, 'Managed session time well, stayed focused on the problem'),
  ('cccc0004-1111-2222-3333-444444444444', '44444444-2222-aaaa-bbbb-333333333333', 'bbbb0001-1111-2222-3333-444444444444', 4, 'Adapted well to student personality and learning style'),
  
  -- Standards for bbbb0002 (Teaching Assistant Evaluation Rubric)
  ('cccc0005-1111-2222-3333-444444444444', '11111111-1111-aaaa-bbbb-333333333333', 'bbbb0002-1111-2222-3333-444444444444', 5, 'Excellent use of Socratic questioning to guide student discovery'),
  ('cccc0006-1111-2222-3333-444444444444', '22222222-1111-aaaa-bbbb-333333333333', 'bbbb0002-1111-2222-3333-444444444444', 5, 'Clear articulation of course objectives and learning goals'),
  ('cccc0007-1111-2222-3333-444444444444', '33333333-1111-aaaa-bbbb-333333333333', 'bbbb0002-1111-2222-3333-444444444444', 5, 'Perfect time management throughout the session'),
  ('cccc0008-1111-2222-3333-444444444444', '44444444-1111-aaaa-bbbb-333333333333', 'bbbb0002-1111-2222-3333-444444444444', 5, 'Perfectly adapted approach to student needs'),
  
  -- Standards for bbbb0003 (Teaching Assistant Evaluation Rubric - failed example)
  ('cccc0009-1111-2222-3333-444444444444', '11111111-4444-aaaa-bbbb-333333333333', 'bbbb0003-1111-2222-3333-444444444444', 2, 'Rarely used questioning techniques, often provided hints too quickly'),
  ('cccc0010-1111-2222-3333-444444444444', '22222222-4444-aaaa-bbbb-333333333333', 'bbbb0003-1111-2222-3333-444444444444', 2, 'Limited awareness of course goals with minor misconceptions'),
  ('cccc0011-1111-2222-3333-444444444444', '33333333-3333-aaaa-bbbb-333333333333', 'bbbb0003-1111-2222-3333-444444444444', 3, 'Acceptable time management but slightly rushed explanations'),
  ('cccc0012-1111-2222-3333-444444444444', '44444444-4444-aaaa-bbbb-333333333333', 'bbbb0003-1111-2222-3333-444444444444', 2, 'Minimal ability to adjust to student behavior and needs'),
  
  -- Standards for bbbb0004 (Teaching Assistant Evaluation Rubric)
  ('cccc0013-1111-2222-3333-444444444444', '11111111-1111-aaaa-bbbb-333333333333', 'bbbb0004-1111-2222-3333-444444444444', 5, 'Excellent scaffolding approach, empowered student discovery'),
  ('cccc0014-1111-2222-3333-444444444444', '22222222-1111-aaaa-bbbb-333333333333', 'bbbb0004-1111-2222-3333-444444444444', 5, 'Clear understanding and articulation of proof techniques'),
  ('cccc0015-1111-2222-3333-444444444444', '33333333-2222-aaaa-bbbb-333333333333', 'bbbb0004-1111-2222-3333-444444444444', 4, 'Good time management with minor deviations'),
  ('cccc0016-1111-2222-3333-444444444444', '44444444-3333-aaaa-bbbb-333333333333', 'bbbb0004-1111-2222-3333-444444444444', 3, 'Thoughtful adjustments to support confused student type'),
  
  -- Standards for bbbb0011 (Teaching Assistant Evaluation Rubric - failed example)
  ('cccc0017-1111-2222-3333-444444444444', '11111111-5555-aaaa-bbbb-333333333333', 'bbbb0011-1111-2222-3333-444444444444', 1, 'Directly provided answers without guiding student discovery'),
  ('cccc0018-1111-2222-3333-444444444444', '22222222-5555-aaaa-bbbb-333333333333', 'bbbb0011-1111-2222-3333-444444444444', 1, 'Clear demonstration of not knowing the course material'),
  ('cccc0019-1111-2222-3333-444444444444', '33333333-4444-aaaa-bbbb-333333333333', 'bbbb0011-1111-2222-3333-444444444444', 2, 'Frequently mismanaged time leading to rushed explanations'),
  ('cccc0020-1111-2222-3333-444444444444', '44444444-5555-aaaa-bbbb-333333333333', 'bbbb0011-1111-2222-3333-444444444444', 1, 'Failed to adapt to different student types, uniform responses');



-- GPT GENERATED DATA
INSERT INTO simulation_attempts (id, created_at, user_id, class_id, simulation_id) VALUES
  ('a53608ef-b62f-49eb-95a7-9d83c28e1053', '2025-06-08T05:33:27+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'aaaaaaaa-1111-2222-3333-444444444444'),
  ('b8caee1a-0023-44a3-b283-cc8b3757d73a', '2025-06-07T06:11:08+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'cccccccc-1111-2222-3333-444444444444'),
  ('0ac2f4b8-975e-432f-9b55-fc26e684032f', '2025-06-10T04:18:00+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'c5a0b003-cccc-dddd-eeee-ffffffffffff'),
  ('d781710f-a86b-4d13-9c11-d7159f112add', '2025-06-05T03:58:10+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'cccccccc-1111-2222-3333-444444444444'),
  ('69fba868-ff82-4f16-aab2-7493ae9ae990', '2025-06-06T13:55:25+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'c5a0b001-aaaa-bbbb-cccc-dddddddddddd'),
  ('566195bd-bea2-4565-8070-32927329ffe8', '2025-06-09T13:42:42+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'aaaaaaaa-1111-2222-3333-444444444444'),
  ('48771729-2ce2-4b07-bb7b-fe3211e79157', '2025-06-06T18:23:05+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'cccccccc-1111-2222-3333-444444444444'),
  ('743b5b31-1397-4ce1-a826-acc494b7a979', '2025-06-09T00:18:55+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee'),
  ('6b655cf6-e155-407d-8b7d-d8b28270c9e7', '2025-06-11T02:23:11+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'c5a0b001-aaaa-bbbb-cccc-dddddddddddd'),
  ('74f76e56-fb70-42fc-b989-9db37530654d', '2025-06-06T14:42:45+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-1111-1111-1111-111111111111', 'c5a0b003-cccc-dddd-eeee-ffffffffffff'),
  ('9ea8253e-093d-4cc4-a760-449dcb2f51ed', '2025-06-05T06:47:58+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '55555555-2222-2222-2222-222222222222', 'bbbbbbbb-1111-2222-3333-444444444444'),
  ('01011bff-8b82-4aa0-9eb0-f782c9f8b6a1', '2025-06-09T17:43:59+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '55555555-2222-2222-2222-222222222222', 'bbbbbbbb-1111-2222-3333-444444444444'),
  ('3922f6da-b0cd-43f3-8cc0-ce83ff4b1355', '2025-06-06T15:54:00+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '77777777-4444-4444-4444-444444444444', 'c5a0b003-cccc-dddd-eeee-ffffffffffff'),
  ('fe8ba2ea-ef97-401e-b5d2-fe5c97501bea', '2025-06-10T06:10:47+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '55555555-2222-2222-2222-222222222222', 'cccccccc-1111-2222-3333-444444444444'),
  ('f974710a-3b5d-4780-862c-567f10bd48a8', '2025-06-05T15:39:23+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '77777777-4444-4444-4444-444444444444', 'bbbbbbbb-1111-2222-3333-444444444444'),
  ('f3bf58e4-0682-45d2-aae2-15b23000c9bd', '2025-06-08T22:38:21+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '55555555-2222-2222-2222-222222222222', 'bbbbbbbb-1111-2222-3333-444444444444'),
  ('0b63eeb1-1552-4600-9d2c-fed520b4b863', '2025-06-10T22:03:03+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '77777777-4444-4444-4444-444444444444', 'aaaaaaaa-1111-2222-3333-444444444444'),
  ('253dd26b-7714-4f3a-8fe2-fb35de53147f', '2025-06-05T20:47:38+00:00', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '77777777-4444-4444-4444-444444444444', 'c5a0b003-cccc-dddd-eeee-ffffffffffff');
INSERT INTO simulation_chats (id, created_at, completed_at, title, scenario_id, completed, attempt_id) VALUES
  ('e716dbb7-6dd1-45be-8505-3a926d8eb1cd', '2025-06-08T20:39:03+00:00', '2025-06-09T21:01:20+00:00', 'Debug Help', '11111111-aaaa-aaaa-aaaa-111111111111', true, 'a53608ef-b62f-49eb-95a7-9d83c28e1053'),
  ('78f78e09-2294-4d12-82fc-8d598957eea6', '2025-06-08T07:54:10+00:00', '2025-06-10T16:52:06+00:00', 'Algorithm Question', '11111111-aaaa-aaaa-aaaa-111111111111', true, 'b8caee1a-0023-44a3-b283-cc8b3757d73a'),
  ('dccff29b-50ed-43fb-b4ae-046acd38a950', '2025-06-07T10:34:57+00:00', NULL, 'Debug Help', '11111111-aaaa-aaaa-aaaa-111111111111', false, '0ac2f4b8-975e-432f-9b55-fc26e684032f'),
  ('b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', '2025-06-08T23:58:30+00:00', NULL, 'Algorithm Question', '11111111-aaaa-aaaa-aaaa-111111111111', false, 'd781710f-a86b-4d13-9c11-d7159f112add'),
  ('31757414-6a60-4989-89c3-a1dca4310a28', '2025-06-10T21:53:14+00:00', NULL, 'Debug Help', '11111111-aaaa-aaaa-aaaa-111111111111', false, '69fba868-ff82-4f16-aab2-7493ae9ae990'),
  ('6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', '2025-06-11T13:02:16+00:00', NULL, 'Syntax Error', '11111111-aaaa-aaaa-aaaa-111111111111', false, '566195bd-bea2-4565-8070-32927329ffe8'),
  ('5892f23a-aa68-45cb-8a22-28d5905b5086', '2025-06-07T22:17:07+00:00', '2025-06-06T00:29:22+00:00', 'Concept Check', '11111111-aaaa-aaaa-aaaa-111111111111', true, '48771729-2ce2-4b07-bb7b-fe3211e79157'),
  ('f105e00a-ece2-45f1-ab27-75e86dce9695', '2025-06-09T02:21:49+00:00', NULL, 'Concept Check', '11111111-aaaa-aaaa-aaaa-111111111111', false, '743b5b31-1397-4ce1-a826-acc494b7a979'),
  ('753cd889-5143-4666-b099-c43093a797a0', '2025-06-08T20:52:38+00:00', NULL, 'Algorithm Question', '11111111-aaaa-aaaa-aaaa-111111111111', false, '6b655cf6-e155-407d-8b7d-d8b28270c9e7'),
  ('749fcb09-26f8-42a9-9297-00e4a35bc9cf', '2025-06-06T16:27:29+00:00', NULL, 'Concept Check', '11111111-aaaa-aaaa-aaaa-111111111111', false, '74f76e56-fb70-42fc-b989-9db37530654d'),
  ('38e8a262-6412-40e7-adc6-0a9267cabd2c', '2025-06-10T23:02:19+00:00', NULL, 'Algorithm Question', '11111111-aaaa-aaaa-aaaa-111111111111', false, '9ea8253e-093d-4cc4-a760-449dcb2f51ed'),
  ('033fc382-b131-408c-9242-2f0146933303', '2025-06-06T22:05:55+00:00', '2025-06-09T17:09:29+00:00', 'Algorithm Question', '11111111-aaaa-aaaa-aaaa-111111111111', true, '01011bff-8b82-4aa0-9eb0-f782c9f8b6a1'),
  ('bc0a9500-6f24-4398-b843-bf49096c3a39', '2025-06-05T21:31:42+00:00', '2025-06-10T00:29:29+00:00', 'Debug Help', '11111111-aaaa-aaaa-aaaa-111111111111', true, '3922f6da-b0cd-43f3-8cc0-ce83ff4b1355'),
  ('00db4efa-4da2-451d-b74f-ee35d2500514', '2025-06-07T18:48:06+00:00', '2025-06-04T13:57:10+00:00', 'Syntax Error', '11111111-aaaa-aaaa-aaaa-111111111111', true, 'fe8ba2ea-ef97-401e-b5d2-fe5c97501bea'),
  ('fb60fca6-c069-4d82-8a2b-414d77c11a5e', '2025-06-07T06:18:56+00:00', '2025-06-08T10:24:54+00:00', 'Concept Check', '11111111-aaaa-aaaa-aaaa-111111111111', true, 'f974710a-3b5d-4780-862c-567f10bd48a8'),
  ('15bd250e-0e40-44d4-b147-382e50ce3fe1', '2025-06-08T05:07:46+00:00', NULL, 'Concept Check', '11111111-aaaa-aaaa-aaaa-111111111111', false, 'f3bf58e4-0682-45d2-aae2-15b23000c9bd'),
  ('48b1866b-6a8f-43cd-9e59-c10e7283e599', '2025-06-09T18:12:31+00:00', '2025-06-04T17:43:36+00:00', 'Concept Check', '11111111-aaaa-aaaa-aaaa-111111111111', true, '0b63eeb1-1552-4600-9d2c-fed520b4b863'),
  ('1152d9db-086e-4750-b552-188ec8e70616', '2025-06-11T04:09:31+00:00', NULL, 'Algorithm Question', '11111111-aaaa-aaaa-aaaa-111111111111', false, '253dd26b-7714-4f3a-8fe2-fb35de53147f');
INSERT INTO simulation_messages (id, created_at, chat_id, query, response, completed) VALUES
  ('094f1ce2-ae29-4597-acae-10912761610e', '2025-06-04T22:48:58+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Can you explain this output?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('f55454c7-e0d1-4827-afc8-833889a38c9d', '2025-06-06T10:46:19+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('ec5bed96-1b4e-4ec7-aa17-a0a11b0ed20e', '2025-06-10T10:22:30+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'I don''t get why this line is null.', 'Remember to initialize the array before use.', false),
  ('3750517e-e64b-42a9-8c88-e96281c9636d', '2025-06-05T10:28:13+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('cb055cbf-3e2f-46ca-bb69-1533e00b96a3', '2025-06-04T18:11:28+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('1b287a5e-2315-406c-a1da-d8f180b31204', '2025-06-06T11:28:18+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('c3436ff5-30ce-4916-aaf0-38b8fb54f391', '2025-06-08T04:38:12+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Can you explain this output?', 'Remember to initialize the array before use.', false),
  ('a6092d9d-39a2-4764-95d4-83758efcf66b', '2025-06-06T10:34:13+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'What does this recursion actually do?', 'Your base case is missing - that''s why it never terminates.', false),
  ('e54c3a97-58ea-47d5-b89d-7a2f615d7d40', '2025-06-09T16:22:44+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('84e95ed7-6c01-478c-a26b-23fb9a0400d0', '2025-06-10T07:53:41+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Can you explain this output?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('d3a92cdd-5adf-4d19-8250-92f7a8a2d295', '2025-06-10T09:29:42+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'What does this recursion actually do?', 'Your base case is missing - that''s why it never terminates.', false),
  ('c11f2cca-31b7-4c94-b765-7d5e30e031a2', '2025-06-08T08:37:06+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Can you explain this output?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('07c949b6-9622-4c29-9a60-006b3df86460', '2025-06-05T01:28:41+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Can you explain this output?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('16a54e62-943d-4809-8c75-9deda32b2e43', '2025-06-10T14:42:49+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Is my DFA minimal?', 'Your base case is missing - that''s why it never terminates.', false),
  ('53bff11a-83a1-4cd3-9ef8-fc7d99168359', '2025-06-07T04:19:55+00:00', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd', 'Is my DFA minimal?', 'Remember to initialize the array before use.', false),
  ('1b13cb50-510e-417a-932c-41c7e80a5e88', '2025-06-08T14:21:34+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('8a913c1b-a97c-4427-93ec-a8f14fc30ada', '2025-06-06T23:08:29+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'What does this recursion actually do?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('b64fac0f-a191-454d-a8d5-bd2f585d0804', '2025-06-08T21:41:53+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'What does this recursion actually do?', 'Great question! Let''s trace the variable values.', false),
  ('384f642b-7585-4666-9ff9-889c0909c0ca', '2025-06-08T18:57:02+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'Can you explain this output?', 'Your base case is missing - that''s why it never terminates.', false),
  ('01abbd31-3b1d-4f52-847b-414f789fa65e', '2025-06-06T16:49:05+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'What does this recursion actually do?', 'Great question! Let''s trace the variable values.', false),
  ('e60249e8-2b91-45f8-8cb5-0a47ecb62f49', '2025-06-09T00:12:45+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'Is my DFA minimal?', 'Your base case is missing - that''s why it never terminates.', false),
  ('2bf9e641-af0d-430a-87aa-714146c9e916', '2025-06-08T23:44:01+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'How do I optimize this loop?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('1363dfd3-9af3-4624-a4dc-ad86ca837576', '2025-06-06T00:00:55+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('05c16ca5-2f85-4396-85e1-e3f98eba5f96', '2025-06-09T20:59:43+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('eaf7a1ee-8637-4afe-bc17-00f8991a8727', '2025-06-05T00:40:38+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'What does this recursion actually do?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('7e24f4dd-ec32-48ba-88c5-66df375e9939', '2025-06-06T08:52:31+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'Is my DFA minimal?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('920ea820-0649-4d0b-90bd-488472d4b032', '2025-06-07T04:13:36+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'I don''t get why this line is null.', 'Remember to initialize the array before use.', false),
  ('23fdd73d-adfd-4675-8c0f-3ed05946bf76', '2025-06-05T09:15:19+00:00', '78f78e09-2294-4d12-82fc-8d598957eea6', 'How do I optimize this loop?', 'Great question! Let''s trace the variable values.', false),
  ('bf56f6ff-fb0a-4f70-8630-b0b9ab33a758', '2025-06-06T07:01:52+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('658e7466-725d-479e-b90c-bb61839854cd', '2025-06-11T12:43:14+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'What does this recursion actually do?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('f68c7702-311c-4929-9488-2f03e710efb0', '2025-06-09T09:37:46+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('df0bf54f-c00b-4051-9264-7a25daaa9e12', '2025-06-07T22:44:14+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('6517ec0b-7a8b-4a5a-be82-cda1451ce72d', '2025-06-09T03:43:43+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('dfe94e5a-1543-4e50-a983-1da17df136c2', '2025-06-09T14:36:40+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('e3ea03aa-4c1c-4b92-b8ea-399346430cac', '2025-06-11T13:29:57+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'Is my DFA minimal?', 'Your base case is missing - that''s why it never terminates.', false),
  ('3b021d84-aa03-47bb-af9c-1bf8ca539a27', '2025-06-05T15:20:56+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('6cba87ad-1542-4fb0-93af-a023d61bb2ee', '2025-06-07T03:56:24+00:00', 'dccff29b-50ed-43fb-b4ae-046acd38a950', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('509bd968-9ef6-4c5a-b17f-b5e7a08b3e63', '2025-06-06T17:27:03+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'What does this recursion actually do?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('a0d8463f-c561-4124-be8f-652113009ada', '2025-06-05T06:54:39+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'How do I optimize this loop?', 'Great question! Let''s trace the variable values.', false),
  ('5e96ee7d-61f5-4af6-82e1-7f7c9d9f0507', '2025-06-08T13:27:29+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('771217fc-0336-4fe7-9db9-1590c405416e', '2025-06-07T11:11:28+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'Can you explain this output?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('a859b22c-5bf5-411f-8c7d-a1f99742a6b2', '2025-06-04T20:19:28+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('3004ff2c-e797-4ccb-ab6f-2c6b4802c93a', '2025-06-08T21:31:22+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('5a8aa487-3ba6-40f3-ad9b-9084ceb4d342', '2025-06-10T20:31:03+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('92e036e4-3560-4db1-93ff-619f2c876b92', '2025-06-11T04:30:58+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'What does this recursion actually do?', 'Great question! Let''s trace the variable values.', false),
  ('5ee0b322-b2f7-498c-9b6d-928ed606fe83', '2025-06-05T07:54:25+00:00', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('bb64bb7f-1559-4333-b91d-6db9e407c2a7', '2025-06-06T16:23:37+00:00', '31757414-6a60-4989-89c3-a1dca4310a28', 'What does this recursion actually do?', 'Great question! Let''s trace the variable values.', false),
  ('0f47541d-30db-4f1f-85ca-eac34701ca61', '2025-06-08T13:14:21+00:00', '31757414-6a60-4989-89c3-a1dca4310a28', 'I don''t get why this line is null.', 'Remember to initialize the array before use.', false),
  ('2d8395cb-3bca-4138-a7e2-60a8b2c40c84', '2025-06-05T01:27:40+00:00', '31757414-6a60-4989-89c3-a1dca4310a28', 'How do I optimize this loop?', 'Remember to initialize the array before use.', false),
  ('ab6511e1-e47f-49e5-9474-7ef9cd4f9bf3', '2025-06-06T10:47:02+00:00', '31757414-6a60-4989-89c3-a1dca4310a28', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('bbf489fd-c356-4dc8-bf39-ea0bce9c898c', '2025-06-05T22:54:56+00:00', '31757414-6a60-4989-89c3-a1dca4310a28', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('9442e5d9-05a1-4104-99d7-d70fc118ad63', '2025-06-06T01:08:06+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'What does this recursion actually do?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('3a22bea6-17e2-4483-b095-f838bae4ef78', '2025-06-04T19:47:11+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'How do I optimize this loop?', 'Remember to initialize the array before use.', false),
  ('13f2a7c7-e6e9-4e3d-a5f9-be9e6b12661d', '2025-06-09T06:21:14+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('62482373-bee2-4a11-b3b7-49c0308263be', '2025-06-10T20:37:52+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('f0007098-318a-4380-98eb-b5a5c7a574fe', '2025-06-10T19:54:38+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'What does this recursion actually do?', 'Great question! Let''s trace the variable values.', false),
  ('087e9621-7490-4fa3-89b6-cca5dbf958fe', '2025-06-10T23:03:38+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'Is my DFA minimal?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('24eb05c4-f61a-45e2-8853-2ea4ff99f213', '2025-06-05T11:12:00+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'Is my DFA minimal?', 'Remember to initialize the array before use.', false),
  ('70abea59-9b85-48ae-8bf8-31220e9f1866', '2025-06-10T21:05:54+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('dc017a23-e8f1-4b73-bc94-b46e0f95b94d', '2025-06-09T07:32:25+00:00', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8', 'Can you explain this output?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('9572ba5b-ed54-4c4e-b72e-25d3666065eb', '2025-06-11T10:57:09+00:00', '5892f23a-aa68-45cb-8a22-28d5905b5086', 'How do I optimize this loop?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('69802b32-f368-47ea-83b0-4319bcb0f5ba', '2025-06-04T17:40:55+00:00', '5892f23a-aa68-45cb-8a22-28d5905b5086', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('30611d8a-6f13-4df9-a7c8-d8b865350a06', '2025-06-05T01:04:06+00:00', '5892f23a-aa68-45cb-8a22-28d5905b5086', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('c0736e89-b9bb-487f-b2a9-ef0a3cd7b249', '2025-06-08T08:25:14+00:00', '5892f23a-aa68-45cb-8a22-28d5905b5086', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('5ebf8b56-a10c-4408-a0d4-02b7c1243589', '2025-06-10T17:37:44+00:00', '5892f23a-aa68-45cb-8a22-28d5905b5086', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('1b40e512-25e4-4c9b-b120-45a46cc3d806', '2025-06-08T02:39:26+00:00', '5892f23a-aa68-45cb-8a22-28d5905b5086', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('ff5c8cf1-2620-4991-bbc8-581b7aa14cff', '2025-06-05T15:22:14+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'What does this recursion actually do?', 'Great question! Let''s trace the variable values.', false),
  ('a373acbf-861d-4141-9cbd-c2ebf7e159d1', '2025-06-10T10:46:55+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'How do I optimize this loop?', 'Your base case is missing - that''s why it never terminates.', false),
  ('45863687-a26c-4483-82ac-aa1886f87d02', '2025-06-11T00:49:28+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'Can you explain this output?', 'Your base case is missing - that''s why it never terminates.', false),
  ('a8920144-ca84-41a9-993d-4bbe1c40e277', '2025-06-09T23:33:42+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('0bd9bc44-2fb3-448f-ba15-7014e1de6671', '2025-06-06T04:58:18+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'Is my DFA minimal?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('4c5bcc15-1af0-453f-b1b6-ccb46bc7e732', '2025-06-04T18:17:23+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('35a9980f-4c7b-40fd-a055-b5aea589ac65', '2025-06-10T15:44:58+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('fc510ff6-4893-4ea4-af8c-0b834a9a1031', '2025-06-11T03:10:18+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'What does this recursion actually do?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('81b8d630-c042-432e-b1b4-75e4a20011c4', '2025-06-04T20:43:52+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('709aa74a-f7c4-4201-844f-b914dea3186c', '2025-06-10T00:32:40+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'Can you explain this output?', 'Your base case is missing - that''s why it never terminates.', false),
  ('7e9f136f-93a1-4707-9317-7febc815cfe0', '2025-06-07T03:27:12+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'Can you explain this output?', 'Your base case is missing - that''s why it never terminates.', false),
  ('7560259d-f6cc-4589-82cf-c569a9199796', '2025-06-09T00:28:35+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('ba429abc-23ca-4dff-bca0-50de6a7d7ffb', '2025-06-07T06:38:58+00:00', 'f105e00a-ece2-45f1-ab27-75e86dce9695', 'Is my DFA minimal?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('cb4ed90f-5bb4-4173-a43a-2d525fab4838', '2025-06-07T07:49:13+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('20308a84-d0fb-4006-b1c2-66d0ebcc0178', '2025-06-08T20:44:04+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'Can you explain this output?', 'Remember to initialize the array before use.', false),
  ('540364b6-0a5b-468c-9809-6a6fb311f2c8', '2025-06-06T17:36:15+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'What does this recursion actually do?', 'Your base case is missing - that''s why it never terminates.', false),
  ('bd91ccaf-021c-4367-9d55-cd5913ba9322', '2025-06-10T17:26:44+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'What does this recursion actually do?', 'Your base case is missing - that''s why it never terminates.', false),
  ('52061f23-5436-4eba-9ea8-80c341a7cbe0', '2025-06-05T09:17:26+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'How do I optimize this loop?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('4b688361-85b1-4d8a-baf7-05c14a49049d', '2025-06-07T13:12:41+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('88da6d53-5f26-4b1a-bbba-6f8a5d62544b', '2025-06-08T09:34:53+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('ed61f911-c527-4c59-8162-a3e98db9fe0d', '2025-06-08T08:20:35+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('47317511-9b83-4a7f-a98b-c4bcda73b6d3', '2025-06-06T07:05:23+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'What does this recursion actually do?', 'Your base case is missing - that''s why it never terminates.', false),
  ('f7f9f516-c358-421b-9dcb-145bad443d05', '2025-06-06T06:33:24+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('8f9de01e-ef61-4eb5-ad8b-fae01a094ccb', '2025-06-10T03:58:53+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'How do I optimize this loop?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('37df4505-084f-4561-94e5-894b20c5ef35', '2025-06-09T06:18:04+00:00', '753cd889-5143-4666-b099-c43093a797a0', 'What does this recursion actually do?', 'Great question! Let''s trace the variable values.', false),
  ('f5dabdde-f391-421c-99f2-e598a86dea38', '2025-06-10T00:35:26+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('535007d3-8968-4548-b2a9-9795acb657f0', '2025-06-06T23:13:54+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('981fec3c-f9e3-4701-a087-136e515fa231', '2025-06-04T15:54:06+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'What does this recursion actually do?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('dd17d718-3197-42cd-a93d-7ffcee55aa4a', '2025-06-04T22:04:03+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'Can you explain this output?', 'Your base case is missing - that''s why it never terminates.', false),
  ('7fb472cb-70ca-4899-8b86-d00ea9f827ad', '2025-06-08T02:05:46+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('6f4f227d-8c93-4787-8bae-45099f69f78e', '2025-06-07T15:48:14+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'How do I optimize this loop?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('87cf47a7-bdd3-40df-8838-798cc2743058', '2025-06-06T04:52:38+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('f6a3f0ad-9c32-4f27-94fd-c7589ee762da', '2025-06-05T19:50:25+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('89a846a4-bfcc-473e-b7fc-b5c696b8ffc7', '2025-06-08T03:00:25+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('f3a58afe-95cc-4343-9b57-9fb122c9edb5', '2025-06-07T12:02:06+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'Can you explain this output?', 'Remember to initialize the array before use.', false),
  ('e66499cc-a621-4772-a8ea-b60ca3f8b15f', '2025-06-07T19:14:58+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'I don''t get why this line is null.', 'Remember to initialize the array before use.', false),
  ('20ebdfd9-cc0e-4832-99f9-7ad72574686a', '2025-06-09T18:44:45+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('7ec59d32-a6b4-47a1-990a-b9134ab60e5f', '2025-06-08T14:21:00+00:00', '749fcb09-26f8-42a9-9297-00e4a35bc9cf', 'How do I optimize this loop?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('c035db13-a82e-4938-af9c-a51f37149ec5', '2025-06-06T00:42:42+00:00', '38e8a262-6412-40e7-adc6-0a9267cabd2c', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('7ea54b1b-5442-442a-9fdd-cdb0a79181c0', '2025-06-05T02:57:44+00:00', '38e8a262-6412-40e7-adc6-0a9267cabd2c', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('3ab8f93e-a323-424d-8469-99385addfa4d', '2025-06-07T17:14:45+00:00', '38e8a262-6412-40e7-adc6-0a9267cabd2c', 'How do I optimize this loop?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('7b5eada4-60a8-41e9-a4bf-834e03e3897c', '2025-06-05T10:38:18+00:00', '38e8a262-6412-40e7-adc6-0a9267cabd2c', 'How do I optimize this loop?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('03bfb5fd-ce54-432d-a809-413a4f1f0b25', '2025-06-06T03:47:02+00:00', '38e8a262-6412-40e7-adc6-0a9267cabd2c', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('46aeca85-e8ab-49f8-80bb-03ecf3a6c0de', '2025-06-06T02:34:24+00:00', '38e8a262-6412-40e7-adc6-0a9267cabd2c', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('3e42d62e-747b-4675-9a91-df8c63ed0ae0', '2025-06-06T12:49:36+00:00', '033fc382-b131-408c-9242-2f0146933303', 'How do I optimize this loop?', 'Your base case is missing - that''s why it never terminates.', false),
  ('6f0c7ca0-3e14-4066-b20a-94b8c5384de0', '2025-06-04T23:37:07+00:00', '033fc382-b131-408c-9242-2f0146933303', 'How do I optimize this loop?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('a42a7fbc-c4fd-49f7-9f84-002c6ab7b1c0', '2025-06-10T19:31:46+00:00', '033fc382-b131-408c-9242-2f0146933303', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('6fc8a59e-379d-4a98-9734-b70559e76372', '2025-06-06T20:13:20+00:00', '033fc382-b131-408c-9242-2f0146933303', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('c5449345-2153-460e-b9fc-b45ee7ee4a53', '2025-06-04T13:59:01+00:00', '033fc382-b131-408c-9242-2f0146933303', 'How do I optimize this loop?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('f48a60ed-5ecd-42e0-ac99-b921590e4fa7', '2025-06-11T11:56:54+00:00', '033fc382-b131-408c-9242-2f0146933303', 'What does this recursion actually do?', 'Your base case is missing - that''s why it never terminates.', false),
  ('5ea5091c-7df7-4cc2-9a4c-1be898d4c91b', '2025-06-04T17:16:29+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('637e1c50-79e4-46b8-b6af-8c047be34466', '2025-06-06T08:49:23+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('edbc3b4b-49ab-4d0d-a2f8-1146ed7d54a2', '2025-06-09T08:44:00+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'Can you explain this output?', 'Your base case is missing - that''s why it never terminates.', false),
  ('d6671877-0970-4382-9102-03d90c136c2d', '2025-06-06T23:14:37+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('fbd9bae2-76c0-4976-b138-108eefa1d892', '2025-06-06T01:13:30+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'What does this recursion actually do?', 'Your base case is missing - that''s why it never terminates.', false),
  ('9d982b36-e089-44a7-97c5-31ac1b9c14e3', '2025-06-06T23:14:14+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'What does this recursion actually do?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('144e1d10-bdfc-4264-89e3-5fd3446276fa', '2025-06-08T12:11:11+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'Can you explain this output?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('d78fd20b-303e-413d-b5c7-e317114eff1a', '2025-06-11T08:01:12+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('d75704bf-702d-4681-947a-29b10a114bd5', '2025-06-07T07:43:56+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('d557b851-09d0-4469-9743-5011908b10f3', '2025-06-11T01:56:23+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'Can you explain this output?', 'Remember to initialize the array before use.', false),
  ('41adce85-bfb5-4e6b-bca6-10fc14090a27', '2025-06-09T03:35:52+00:00', 'bc0a9500-6f24-4398-b843-bf49096c3a39', 'Can you explain this output?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('81bb2f3f-2c70-49af-90da-9ed54e2275cc', '2025-06-09T03:53:53+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Can you explain this output?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('6a92468d-9ac7-41e2-af53-7afb27fbdbf8', '2025-06-08T14:55:50+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Can you explain this output?', 'Your base case is missing - that''s why it never terminates.', false),
  ('a2538d53-6359-4e8b-b699-9cc131fecb9f', '2025-06-10T02:24:21+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('581f1101-1109-4ab9-bad9-717843cf8df6', '2025-06-07T08:32:07+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Is my DFA minimal?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('e3e59b27-2aeb-468b-9fee-316958636e5f', '2025-06-07T01:43:45+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Can you explain this output?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('c589df86-f8b6-4acf-9417-bbbccaacad2e', '2025-06-07T10:16:30+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Can you explain this output?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('b8e6c387-871c-42db-a052-28cab874c07e', '2025-06-05T14:53:03+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Can you explain this output?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('1f762aca-da20-4368-8960-aba535d84f9a', '2025-06-07T04:10:15+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'How do I optimize this loop?', 'Remember to initialize the array before use.', false),
  ('49b070dd-067a-4d1b-8a58-bab203fd347e', '2025-06-06T06:49:15+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'I don''t get why this line is null.', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('50aa5222-888a-4f18-bd4f-0db223e20d01', '2025-06-08T06:59:55+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('854928cd-7d14-4c51-a873-c1cee5e4bef7', '2025-06-05T16:50:13+00:00', '00db4efa-4da2-451d-b74f-ee35d2500514', 'How do I optimize this loop?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('efe071e4-25c1-4b84-8e06-9365a56881fd', '2025-06-08T05:11:48+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('901577c0-77da-416f-abdf-3904dff9150a', '2025-06-05T07:11:14+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('1d20b5f0-044d-4170-b733-37145cd16624', '2025-06-08T15:21:56+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'How do I optimize this loop?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('323b1627-e865-45a2-b8a6-839d9b725995', '2025-06-04T19:57:32+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'I don''t get why this line is null.', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('4f2c2638-bd47-4bc9-b430-2b5f77d2d297', '2025-06-05T14:42:13+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'How do I optimize this loop?', 'Great question! Let''s trace the variable values.', false),
  ('ed0a599f-490c-4b7b-be26-eb1d9a653a30', '2025-06-10T10:33:43+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('b800035f-7200-4a18-b30c-665b751780e3', '2025-06-06T15:52:31+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('146f7497-4a13-4f53-8c13-4cadc2bc173a', '2025-06-07T02:10:51+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'How do I optimize this loop?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('43da0619-21ca-459d-8d43-fe603977ded6', '2025-06-05T03:01:25+00:00', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e', 'What does this recursion actually do?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('7f292fea-93c0-4773-9c1a-3a8cc3cebf90', '2025-06-09T05:07:29+00:00', '15bd250e-0e40-44d4-b147-382e50ce3fe1', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('5b8e32ae-aa17-4039-9540-e471850f8716', '2025-06-07T04:33:05+00:00', '15bd250e-0e40-44d4-b147-382e50ce3fe1', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('3ade6860-2c3e-49c0-96eb-df5e73704585', '2025-06-11T09:32:41+00:00', '15bd250e-0e40-44d4-b147-382e50ce3fe1', 'Is my DFA minimal?', 'Remember to initialize the array before use.', false),
  ('add0e119-bda9-413e-83fa-8f6f08f760e1', '2025-06-08T05:46:00+00:00', '15bd250e-0e40-44d4-b147-382e50ce3fe1', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('c1f4df0d-6109-45ed-8e07-5cfb7b589d46', '2025-06-04T20:29:18+00:00', '15bd250e-0e40-44d4-b147-382e50ce3fe1', 'What does this recursion actually do?', 'Remember to initialize the array before use.', false),
  ('4e5c3d8e-e54f-41e0-8f4e-56bf8dd06dfc', '2025-06-05T14:41:13+00:00', '15bd250e-0e40-44d4-b147-382e50ce3fe1', 'Can you explain this output?', 'Great question! Let''s trace the variable values.', false),
  ('ef132a37-1455-48e4-b519-86204c45f0d8', '2025-06-08T13:22:29+00:00', '48b1866b-6a8f-43cd-9e59-c10e7283e599', 'Can you explain this output?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('fffaff47-fb7c-4324-afd3-6c30542ab626', '2025-06-06T12:26:46+00:00', '48b1866b-6a8f-43cd-9e59-c10e7283e599', 'Is my DFA minimal?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('2189b5be-96e3-4dc1-94aa-363792f05a05', '2025-06-08T19:55:46+00:00', '48b1866b-6a8f-43cd-9e59-c10e7283e599', 'Is my DFA minimal?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('5e2c90b8-57ff-48ff-b13b-815438e8c1c6', '2025-06-06T02:26:38+00:00', '48b1866b-6a8f-43cd-9e59-c10e7283e599', 'How do I optimize this loop?', 'Your base case is missing - that''s why it never terminates.', false),
  ('78cf36b0-80ea-47e3-9e9b-6e9bf06613db', '2025-06-06T08:45:36+00:00', '48b1866b-6a8f-43cd-9e59-c10e7283e599', 'What does this recursion actually do?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('c90dc125-1766-42e6-aee3-8fbf3488d918', '2025-06-10T20:07:20+00:00', '48b1866b-6a8f-43cd-9e59-c10e7283e599', 'Is my DFA minimal?', 'Great question! Let''s trace the variable values.', false),
  ('96becec2-528b-4c63-be44-f60765fe1c3d', '2025-06-08T03:19:05+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'How do I optimize this loop?', 'Great question! Let''s trace the variable values.', false),
  ('d3efd2cb-b534-4a42-9cbb-6cd2f07cd92b', '2025-06-08T17:40:34+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'What does this recursion actually do?', 'Yes, remove state Q3 - it''s unreachable.', false),
  ('d8caec22-5ff6-4c0d-9127-aee995cb29ad', '2025-06-09T04:02:48+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'How do I optimize this loop?', 'Great question! Let''s trace the variable values.', false),
  ('52959a5f-1968-4c66-9ac3-7edf29acfdaf', '2025-06-04T23:03:01+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'I don''t get why this line is null.', 'Remember to initialize the array before use.', false),
  ('4248f27e-7a57-4bd8-8de6-af960485ebc3', '2025-06-08T08:17:41+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'I don''t get why this line is null.', 'Great question! Let''s trace the variable values.', false),
  ('4e36bdcf-8733-4f7f-925d-c4381226bdf8', '2025-06-10T20:17:41+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'I don''t get why this line is null.', 'Your base case is missing - that''s why it never terminates.', false),
  ('c6c92d60-c20d-48cf-9458-fdae50b88edd', '2025-06-04T15:52:20+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'What does this recursion actually do?', 'Try pre-allocating the vector; it avoids re-allocation.', false),
  ('cb663412-6021-4e28-847d-49359f32fac6', '2025-06-10T01:26:42+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'How do I optimize this loop?', 'Your base case is missing - that''s why it never terminates.', false),
  ('f94fb725-8986-4852-a9c8-eea66e3f59d1', '2025-06-06T16:25:36+00:00', '1152d9db-086e-4750-b552-188ec8e70616', 'What does this recursion actually do?', 'Yes, remove state Q3 - it''s unreachable.', false);
INSERT INTO simulation_chat_grades (id, created_at, passed, score, time_taken, rubric_id, simulation_chat_id) VALUES
  ('eaba3067-efbe-4ded-ac98-123eda1a5a03', '2025-06-08T19:17:08+00:00', true, 62, 1954, '33333333-3333-3333-3333-333333333333', 'e716dbb7-6dd1-45be-8505-3a926d8eb1cd'),
  ('cf76d743-1a45-4d20-8f94-50f8bd7ecc94', '2025-06-09T15:04:03+00:00', true, 67, 913, '33333333-3333-3333-3333-333333333333', '78f78e09-2294-4d12-82fc-8d598957eea6'),
  ('d1eec8c5-7d49-4dfa-a1c7-a3b1081316b6', '2025-06-10T14:43:34+00:00', true, 75, 1761, '33333333-3333-3333-3333-333333333333', 'dccff29b-50ed-43fb-b4ae-046acd38a950'),
  ('71defdc7-ae6b-4d7f-869f-763cf5827eb6', '2025-06-09T23:07:37+00:00', false, 73, 1704, '33333333-3333-3333-3333-333333333333', 'b0bc9683-3b83-4fc1-aeb3-0dd73c78d3a6'),
  ('d4e4766b-d2d4-4e16-9df5-0ffe6ee4f74e', '2025-06-10T22:55:51+00:00', false, 95, 800, '33333333-3333-3333-3333-333333333333', '31757414-6a60-4989-89c3-a1dca4310a28'),
  ('2b2f8270-4efe-4dad-a0af-abb3ad6d11e4', '2025-06-10T02:44:46+00:00', true, 75, 1426, '33333333-3333-3333-3333-333333333333', '6471d73a-dd2a-4fcb-a2d6-02fc5040ecd8'),
  ('e9f1b997-d05c-4007-b2a6-4b9eae90e9da', '2025-06-04T20:07:34+00:00', false, 93, 616, '33333333-3333-3333-3333-333333333333', '5892f23a-aa68-45cb-8a22-28d5905b5086'),
  ('03edad1c-c9d1-4ec0-b773-150cb66da6ca', '2025-06-09T10:05:44+00:00', true, 75, 932, '33333333-3333-3333-3333-333333333333', 'f105e00a-ece2-45f1-ab27-75e86dce9695'),
  ('78b82a04-93ed-43f2-b6b1-b10c227aee9e', '2025-06-05T00:49:49+00:00', false, 60, 1664, '33333333-3333-3333-3333-333333333333', '753cd889-5143-4666-b099-c43093a797a0'),
  ('c2c2cf49-e18b-4973-84e8-a27e00c5a906', '2025-06-04T13:59:22+00:00', true, 89, 1448, '33333333-3333-3333-3333-333333333333', '749fcb09-26f8-42a9-9297-00e4a35bc9cf'),
  ('09d678c5-deac-4dca-b301-498bf0bd09ae', '2025-06-08T15:58:49+00:00', false, 93, 1592, '33333333-3333-3333-3333-333333333333', '38e8a262-6412-40e7-adc6-0a9267cabd2c'),
  ('58b53221-7c62-49f8-8e9e-407ef011d64a', '2025-06-04T22:35:35+00:00', false, 86, 1702, '33333333-3333-3333-3333-333333333333', '033fc382-b131-408c-9242-2f0146933303'),
  ('53c68a62-08ee-4463-aa3c-04b0ebe2b0a9', '2025-06-05T19:43:52+00:00', true, 75, 858, '33333333-3333-3333-3333-333333333333', 'bc0a9500-6f24-4398-b843-bf49096c3a39'),
  ('b76c4608-e7d0-4996-b338-5cbd1f2489ab', '2025-06-10T12:25:24+00:00', false, 80, 1102, '33333333-3333-3333-3333-333333333333', '00db4efa-4da2-451d-b74f-ee35d2500514'),
  ('6b8a7d51-04e9-40e6-b861-4fca12128834', '2025-06-08T06:45:20+00:00', false, 82, 1529, '33333333-3333-3333-3333-333333333333', 'fb60fca6-c069-4d82-8a2b-414d77c11a5e'),
  ('f6326edc-98e1-48f9-8b7d-771106c96f92', '2025-06-06T05:22:11+00:00', false, 90, 1580, '33333333-3333-3333-3333-333333333333', '15bd250e-0e40-44d4-b147-382e50ce3fe1'),
  ('9cc6fd88-7c15-4d12-be80-a2632930ae26', '2025-06-10T14:01:05+00:00', true, 73, 1141, '33333333-3333-3333-3333-333333333333', '48b1866b-6a8f-43cd-9e59-c10e7283e599'),
  ('ba2f7a9a-9107-4dac-9954-74e7168d9789', '2025-06-11T02:03:19+00:00', false, 88, 764, '33333333-3333-3333-3333-333333333333', '1152d9db-086e-4750-b552-188ec8e70616');
INSERT INTO simulation_chat_feedbacks (id, created_at, standard_id, simulation_chat_grade_id, total, feedback) VALUES
  ('3c5f8567-08a2-428e-ad17-4b8ede95b959', '2025-06-10T14:25:29+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'eaba3067-efbe-4ded-ac98-123eda1a5a03', 4, 'Nice pacing.'),
  ('6a0ec127-9210-4545-88ed-824121240970', '2025-06-10T08:14:49+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'eaba3067-efbe-4ded-ac98-123eda1a5a03', 4, 'Good scaffolding.'),
  ('491273a0-d885-4b10-a263-1cf2a8048a38', '2025-06-08T04:42:00+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'eaba3067-efbe-4ded-ac98-123eda1a5a03', 4, 'Adapted well to student.'),
  ('8a707dc7-e4d0-4faf-97d9-fa06762c93d4', '2025-06-07T03:24:02+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'eaba3067-efbe-4ded-ac98-123eda1a5a03', 4, 'Adapted well to student.'),
  ('8900f9c7-43a9-4a8d-89cb-570fc292035c', '2025-06-10T19:09:43+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'cf76d743-1a45-4d20-8f94-50f8bd7ecc94', 4, 'Adapted well to student.'),
  ('2c585c31-007f-4355-86b6-09533b722738', '2025-06-06T22:30:40+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'cf76d743-1a45-4d20-8f94-50f8bd7ecc94', 4, 'Adapted well to student.'),
  ('38c7849c-ea2a-4dec-8f0d-425cc10ccbd0', '2025-06-05T03:33:00+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'cf76d743-1a45-4d20-8f94-50f8bd7ecc94', 4, 'Adapted well to student.'),
  ('05256f41-ce02-44db-ac45-abc919bb1a4f', '2025-06-04T20:31:37+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'cf76d743-1a45-4d20-8f94-50f8bd7ecc94', 4, 'Nice pacing.'),
  ('43c57d97-35b0-4ed6-86f1-5311c0834b5f', '2025-06-05T16:06:39+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'd1eec8c5-7d49-4dfa-a1c7-a3b1081316b6', 4, 'Solid explanation.'),
  ('45df1c9d-dd8d-4898-a27c-ba8182836c28', '2025-06-05T02:30:14+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'd1eec8c5-7d49-4dfa-a1c7-a3b1081316b6', 4, 'Solid explanation.'),
  ('285fcb9b-ee83-46cf-8eb3-d3abd8070a9f', '2025-06-10T00:16:08+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'd1eec8c5-7d49-4dfa-a1c7-a3b1081316b6', 4, 'Good scaffolding.'),
  ('c3e105c9-d7f8-440a-87a3-75c305e7dc1d', '2025-06-04T21:31:26+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'd1eec8c5-7d49-4dfa-a1c7-a3b1081316b6', 4, 'Adapted well to student.'),
  ('5dada54e-881e-4fed-97f6-5b4fb00b1c14', '2025-06-08T14:53:15+00:00', '11111111-2222-aaaa-bbbb-333333333333', '71defdc7-ae6b-4d7f-869f-763cf5827eb6', 4, 'Adapted well to student.'),
  ('d7438118-580f-421f-b4f8-6ba0e4663993', '2025-06-06T15:06:03+00:00', '22222222-2222-aaaa-bbbb-333333333333', '71defdc7-ae6b-4d7f-869f-763cf5827eb6', 4, 'Adapted well to student.'),
  ('d15fbb9f-3ddb-42f4-8f07-8efaafa7af9c', '2025-06-10T10:11:29+00:00', '33333333-2222-aaaa-bbbb-333333333333', '71defdc7-ae6b-4d7f-869f-763cf5827eb6', 4, 'Good scaffolding.'),
  ('ac4d7955-233f-4ed9-a760-8ac5b375ff6d', '2025-06-06T08:06:47+00:00', '44444444-2222-aaaa-bbbb-333333333333', '71defdc7-ae6b-4d7f-869f-763cf5827eb6', 4, 'Solid explanation.'),
  ('cc55da62-3095-46ff-9b47-ee5a4b44cf91', '2025-06-10T10:30:03+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'd4e4766b-d2d4-4e16-9df5-0ffe6ee4f74e', 4, 'Solid explanation.'),
  ('227e58a9-4d95-4c7f-864f-4d45d6f45973', '2025-06-09T13:13:27+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'd4e4766b-d2d4-4e16-9df5-0ffe6ee4f74e', 4, 'Good scaffolding.'),
  ('82b1b451-764c-492b-ae70-ce0d1a6d7715', '2025-06-05T16:12:45+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'd4e4766b-d2d4-4e16-9df5-0ffe6ee4f74e', 4, 'Adapted well to student.'),
  ('b4c8179c-41e1-41e2-846f-679382a1f8af', '2025-06-08T23:24:26+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'd4e4766b-d2d4-4e16-9df5-0ffe6ee4f74e', 4, 'Adapted well to student.'),
  ('406addd7-c9b7-4c4c-8e54-6080b1ed1e32', '2025-06-11T02:05:24+00:00', '11111111-2222-aaaa-bbbb-333333333333', '2b2f8270-4efe-4dad-a0af-abb3ad6d11e4', 4, 'Good scaffolding.'),
  ('057c5f59-7c59-4d57-a626-65a92c34ad74', '2025-06-06T11:33:27+00:00', '22222222-2222-aaaa-bbbb-333333333333', '2b2f8270-4efe-4dad-a0af-abb3ad6d11e4', 4, 'Solid explanation.'),
  ('ba8bd29c-639c-4f20-a619-fc39ec7a3e85', '2025-06-08T09:42:44+00:00', '33333333-2222-aaaa-bbbb-333333333333', '2b2f8270-4efe-4dad-a0af-abb3ad6d11e4', 4, 'Nice pacing.'),
  ('ed7a155f-c80c-4fe7-891a-5e0a49bf5feb', '2025-06-07T18:09:11+00:00', '44444444-2222-aaaa-bbbb-333333333333', '2b2f8270-4efe-4dad-a0af-abb3ad6d11e4', 4, 'Good scaffolding.'),
  ('3c97fd01-039a-479c-a8d2-e287fd01e3b7', '2025-06-10T07:29:38+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'e9f1b997-d05c-4007-b2a6-4b9eae90e9da', 4, 'Nice pacing.'),
  ('262e9645-9646-4fe3-81e0-b7b809e0c60d', '2025-06-08T08:38:04+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'e9f1b997-d05c-4007-b2a6-4b9eae90e9da', 4, 'Good scaffolding.'),
  ('e3fc67be-b406-4dae-a423-bdbf4194d220', '2025-06-10T06:29:21+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'e9f1b997-d05c-4007-b2a6-4b9eae90e9da', 4, 'Solid explanation.'),
  ('204de927-ab79-4331-802f-cdb3059fbb94', '2025-06-08T06:20:19+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'e9f1b997-d05c-4007-b2a6-4b9eae90e9da', 4, 'Good scaffolding.'),
  ('a4f9eff9-4478-4ccc-8a38-1293af89416f', '2025-06-11T06:26:46+00:00', '11111111-2222-aaaa-bbbb-333333333333', '03edad1c-c9d1-4ec0-b773-150cb66da6ca', 4, 'Adapted well to student.'),
  ('4609ecf2-a1dc-457d-bc08-dfe29da9c484', '2025-06-07T12:54:35+00:00', '22222222-2222-aaaa-bbbb-333333333333', '03edad1c-c9d1-4ec0-b773-150cb66da6ca', 4, 'Good scaffolding.'),
  ('98259e40-42c4-4651-a152-2be5fc8afdb5', '2025-06-08T13:22:54+00:00', '33333333-2222-aaaa-bbbb-333333333333', '03edad1c-c9d1-4ec0-b773-150cb66da6ca', 4, 'Adapted well to student.'),
  ('8ea22917-fa44-40df-98ce-7840876f4e1c', '2025-06-09T15:17:45+00:00', '44444444-2222-aaaa-bbbb-333333333333', '03edad1c-c9d1-4ec0-b773-150cb66da6ca', 4, 'Nice pacing.'),
  ('f4bdaf1c-24fb-4fcc-8ee1-8b57afc2c084', '2025-06-07T03:34:43+00:00', '11111111-2222-aaaa-bbbb-333333333333', '78b82a04-93ed-43f2-b6b1-b10c227aee9e', 4, 'Good scaffolding.'),
  ('3b2111da-eaee-473e-bf93-571470958447', '2025-06-10T17:17:04+00:00', '22222222-2222-aaaa-bbbb-333333333333', '78b82a04-93ed-43f2-b6b1-b10c227aee9e', 4, 'Adapted well to student.'),
  ('293d27cb-99b3-4d39-91ea-644fb636538e', '2025-06-07T18:13:52+00:00', '33333333-2222-aaaa-bbbb-333333333333', '78b82a04-93ed-43f2-b6b1-b10c227aee9e', 4, 'Nice pacing.'),
  ('c7038319-978a-40b9-ad44-629145bfc833', '2025-06-07T22:11:26+00:00', '44444444-2222-aaaa-bbbb-333333333333', '78b82a04-93ed-43f2-b6b1-b10c227aee9e', 4, 'Solid explanation.'),
  ('5c82d505-e63c-4ea6-a245-9c3d955c23c3', '2025-06-06T21:49:26+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'c2c2cf49-e18b-4973-84e8-a27e00c5a906', 4, 'Good scaffolding.'),
  ('f7750bcf-14b7-4637-93b7-96e321d5f88e', '2025-06-06T17:15:30+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'c2c2cf49-e18b-4973-84e8-a27e00c5a906', 4, 'Adapted well to student.'),
  ('9c3aa80c-33ba-4817-a559-ec693c64f222', '2025-06-09T18:40:57+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'c2c2cf49-e18b-4973-84e8-a27e00c5a906', 4, 'Good scaffolding.'),
  ('19c91aef-1b98-486c-9176-bfdafdca127d', '2025-06-10T06:37:12+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'c2c2cf49-e18b-4973-84e8-a27e00c5a906', 4, 'Solid explanation.'),
  ('02075acf-a4ab-49b5-90b2-4d27f045bb39', '2025-06-06T05:32:37+00:00', '11111111-2222-aaaa-bbbb-333333333333', '09d678c5-deac-4dca-b301-498bf0bd09ae', 4, 'Nice pacing.'),
  ('38b2966a-65ba-4b70-9c04-5e5a52bda579', '2025-06-08T02:26:29+00:00', '22222222-2222-aaaa-bbbb-333333333333', '09d678c5-deac-4dca-b301-498bf0bd09ae', 4, 'Solid explanation.'),
  ('c4d2b807-17b5-4273-882f-19e150c65328', '2025-06-08T06:31:23+00:00', '33333333-2222-aaaa-bbbb-333333333333', '09d678c5-deac-4dca-b301-498bf0bd09ae', 4, 'Good scaffolding.'),
  ('f30d541d-d830-44a2-a8f5-2fb61a871346', '2025-06-07T16:32:37+00:00', '44444444-2222-aaaa-bbbb-333333333333', '09d678c5-deac-4dca-b301-498bf0bd09ae', 4, 'Nice pacing.'),
  ('09a68fe8-0d10-4af9-ae3d-ca0fc03cfdcf', '2025-06-05T15:27:31+00:00', '11111111-2222-aaaa-bbbb-333333333333', '58b53221-7c62-49f8-8e9e-407ef011d64a', 4, 'Good scaffolding.'),
  ('87c1477f-01d2-4731-ac70-e782579a854c', '2025-06-08T06:10:03+00:00', '22222222-2222-aaaa-bbbb-333333333333', '58b53221-7c62-49f8-8e9e-407ef011d64a', 4, 'Good scaffolding.'),
  ('dc77ad9e-f085-45db-88b8-3f0a8f77ef0d', '2025-06-05T16:12:44+00:00', '33333333-2222-aaaa-bbbb-333333333333', '58b53221-7c62-49f8-8e9e-407ef011d64a', 4, 'Adapted well to student.'),
  ('1e27eecc-200b-4e22-ba4e-cd3854c732a5', '2025-06-06T20:24:10+00:00', '44444444-2222-aaaa-bbbb-333333333333', '58b53221-7c62-49f8-8e9e-407ef011d64a', 4, 'Solid explanation.'),
  ('13e0d351-86fb-402c-a219-0b03fdfa5c7d', '2025-06-04T17:23:52+00:00', '11111111-2222-aaaa-bbbb-333333333333', '53c68a62-08ee-4463-aa3c-04b0ebe2b0a9', 4, 'Solid explanation.'),
  ('e40a393b-8c85-44fa-aed9-a89964444c51', '2025-06-05T22:12:53+00:00', '22222222-2222-aaaa-bbbb-333333333333', '53c68a62-08ee-4463-aa3c-04b0ebe2b0a9', 4, 'Good scaffolding.'),
  ('edea3ac5-b6de-4955-ae1e-31d8fab29704', '2025-06-07T02:13:02+00:00', '33333333-2222-aaaa-bbbb-333333333333', '53c68a62-08ee-4463-aa3c-04b0ebe2b0a9', 4, 'Nice pacing.'),
  ('68ecf3e0-6fca-4ee2-aa9c-a17e783f81d2', '2025-06-10T04:18:20+00:00', '44444444-2222-aaaa-bbbb-333333333333', '53c68a62-08ee-4463-aa3c-04b0ebe2b0a9', 4, 'Good scaffolding.'),
  ('da3cdb42-9b8a-44b0-bb30-7ad9c447c8bf', '2025-06-06T02:21:36+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'b76c4608-e7d0-4996-b338-5cbd1f2489ab', 4, 'Nice pacing.'),
  ('eec259bd-e2be-4a4e-934f-d58154a054db', '2025-06-05T22:18:34+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'b76c4608-e7d0-4996-b338-5cbd1f2489ab', 4, 'Good scaffolding.'),
  ('83891b8a-3a7c-421e-ab81-416209a6e03b', '2025-06-07T11:40:59+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'b76c4608-e7d0-4996-b338-5cbd1f2489ab', 4, 'Adapted well to student.'),
  ('5e8fa5be-ae84-4881-afa2-b5801d2b36c8', '2025-06-05T13:41:19+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'b76c4608-e7d0-4996-b338-5cbd1f2489ab', 4, 'Solid explanation.'),
  ('029f34f5-53d6-4500-aed8-1eb6d4d379de', '2025-06-08T12:26:21+00:00', '11111111-2222-aaaa-bbbb-333333333333', '6b8a7d51-04e9-40e6-b861-4fca12128834', 4, 'Nice pacing.'),
  ('06d6354c-e838-4509-9c16-b5e95117ba1b', '2025-06-10T02:31:20+00:00', '22222222-2222-aaaa-bbbb-333333333333', '6b8a7d51-04e9-40e6-b861-4fca12128834', 4, 'Good scaffolding.'),
  ('e9c2f910-0b98-4512-900b-9cbd3d1a050b', '2025-06-07T17:45:20+00:00', '33333333-2222-aaaa-bbbb-333333333333', '6b8a7d51-04e9-40e6-b861-4fca12128834', 4, 'Good scaffolding.'),
  ('1cae12ab-25c7-4c2c-bd50-f497612527ca', '2025-06-05T01:35:02+00:00', '44444444-2222-aaaa-bbbb-333333333333', '6b8a7d51-04e9-40e6-b861-4fca12128834', 4, 'Solid explanation.'),
  ('667ba736-6d4d-4888-a1f8-cade9dd85f49', '2025-06-09T07:57:57+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'f6326edc-98e1-48f9-8b7d-771106c96f92', 4, 'Nice pacing.'),
  ('a3ad4535-d534-41d3-9146-ce31492c91c0', '2025-06-08T12:07:34+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'f6326edc-98e1-48f9-8b7d-771106c96f92', 4, 'Solid explanation.'),
  ('0b71e59d-ba07-4738-bc47-6628a33444a8', '2025-06-10T04:26:07+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'f6326edc-98e1-48f9-8b7d-771106c96f92', 4, 'Adapted well to student.'),
  ('27605c70-bf5f-4a5a-b883-33735c099aa0', '2025-06-06T16:57:04+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'f6326edc-98e1-48f9-8b7d-771106c96f92', 4, 'Solid explanation.'),
  ('08fec71c-d10b-4f34-b892-865ebf9b0f2b', '2025-06-08T15:48:00+00:00', '11111111-2222-aaaa-bbbb-333333333333', '9cc6fd88-7c15-4d12-be80-a2632930ae26', 4, 'Good scaffolding.'),
  ('a157b87c-e58e-4826-9262-2bbcfcecca12', '2025-06-04T20:53:11+00:00', '22222222-2222-aaaa-bbbb-333333333333', '9cc6fd88-7c15-4d12-be80-a2632930ae26', 4, 'Good scaffolding.'),
  ('0d70f338-701a-479c-a212-06feb8563469', '2025-06-09T16:04:20+00:00', '33333333-2222-aaaa-bbbb-333333333333', '9cc6fd88-7c15-4d12-be80-a2632930ae26', 4, 'Solid explanation.'),
  ('291e159d-305f-4075-8ecd-41b51fad2070', '2025-06-06T14:40:35+00:00', '44444444-2222-aaaa-bbbb-333333333333', '9cc6fd88-7c15-4d12-be80-a2632930ae26', 4, 'Solid explanation.'),
  ('ec5087e0-e1b4-41ee-a60d-01197676f55d', '2025-06-07T15:46:58+00:00', '11111111-2222-aaaa-bbbb-333333333333', 'ba2f7a9a-9107-4dac-9954-74e7168d9789', 4, 'Adapted well to student.'),
  ('5786cdef-98b1-45fe-87ac-a1e320f7c9fa', '2025-06-11T06:07:55+00:00', '22222222-2222-aaaa-bbbb-333333333333', 'ba2f7a9a-9107-4dac-9954-74e7168d9789', 4, 'Nice pacing.'),
  ('a3103cdc-ae70-4540-af59-66d323d1a5d6', '2025-06-08T18:59:12+00:00', '33333333-2222-aaaa-bbbb-333333333333', 'ba2f7a9a-9107-4dac-9954-74e7168d9789', 4, 'Solid explanation.'),
  ('494a907a-9193-4ecf-887c-26ab62d73dd7', '2025-06-08T07:09:54+00:00', '44444444-2222-aaaa-bbbb-333333333333', 'ba2f7a9a-9107-4dac-9954-74e7168d9789', 4, 'Solid explanation.');
