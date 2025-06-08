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
  scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- references scenarios instead of interactions
  rubric_id   UUID        NULL REFERENCES rubrics(id) ON DELETE SET NULL -- can be null if no rubric is used
);

CREATE TABLE attempts (
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
  attempt_id UUID         NOT NULL REFERENCES attempts(id)  ON DELETE CASCADE,
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

-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert simulations (Essential for testing)
INSERT INTO simulations (id, title, documents, time_limit, active, scenario_ids) VALUES
  ('aaaaaaaa-bbbb-cccc-dddd-111111111111', 'Coding Practice Simulation', ARRAY[]::UUID[], 15, true, ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[])
ON CONFLICT (id) DO NOTHING;

-- Insert Permanent simulations for Individual Practice
INSERT INTO simulations (id, title, documents, time_limit, active, scenario_ids) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444444', 'Aggressive Student Practice', ARRAY[]::UUID[], NULL, true, ARRAY['aaaaaaaa-1111-2222-3333-444444444444']::UUID[]),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'Happy Student Practice', ARRAY[]::UUID[], NULL, true, ARRAY['bbbbbbbb-1111-2222-3333-444444444444']::UUID[]),
  ('cccccccc-1111-2222-3333-444444444444', 'Confused Student Practice', ARRAY[]::UUID[], NULL, true, ARRAY['cccccccc-1111-2222-3333-444444444444']::UUID[])
ON CONFLICT (id) DO NOTHING;

-- Insert Attempts (Essential for linking chats to simulations and users)
INSERT INTO attempts (id, created_at, user_id, class_id, simulation_id) VALUES
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
  ('aaaaaaaa-1111-2222-3333-444444444450', NOW() - INTERVAL '2 days', NULL, '55555555-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-cccc-dddd-111111111111');

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
  ('f1e2d3c4-b5a6-47f8-9e00-cccccccccccc', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Dynamic Programming', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', true, 'f1e2d3c4-b5a6-47f8-9e00-cccccccccccc');

-- Additional sample chat data for testing
INSERT INTO simulation_chats (id, created_at, completed_at, title, scenario_id, completed, attempt_id) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444441', NOW() - INTERVAL '30 minutes', NULL, 'Infinite Loop', '11111111-aaaa-aaaa-aaaa-111111111111', false, 'aaaaaaaa-1111-2222-3333-444444444441'),
  ('aaaaaaaa-1111-2222-3333-444444444442', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Master Theorem Edge Case', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', true, 'aaaaaaaa-1111-2222-3333-444444444442'),
  ('aaaaaaaa-1111-2222-3333-444444444443', NOW() - INTERVAL '3 hours', NULL, 'Balancing BST', '99999999-cccc-dddd-eeee-999999999999', false, 'aaaaaaaa-1111-2222-3333-444444444443'),
  ('aaaaaaaa-1111-2222-3333-444444444444', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours', 'Adjacency List', '77777777-aaaa-bbbb-cccc-777777777777', true, 'aaaaaaaa-1111-2222-3333-444444444444'),
  ('aaaaaaaa-1111-2222-3333-444444444445', NOW() - INTERVAL '1 day', NULL, 'Set Theory Paradox', '44444444-dddd-dddd-dddd-444444444444', false, 'aaaaaaaa-1111-2222-3333-444444444445');