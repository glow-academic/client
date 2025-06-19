-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE seniority_levels AS ENUM ('freshman', 'sophomore', 'junior', 'senior');
  
CREATE TABLE scenarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL, -- if left blank, the scenario will generate a random description
  agent_id UUID         NULL REFERENCES agents(id)  ON DELETE SET NULL,
  class_id   UUID        NULL REFERENCES classes(id) ON DELETE SET NULL,
  crowdedness INTEGER     NULL,
  intensity INTEGER     NULL,
  seniority seniority_levels NULL,
  documents UUID[]       NULL,
  default_scenario BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert Essential Scenarios (around 10 diverse scenarios)
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, seniority, documents, default_scenario) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Lawson Homework Help', 'You are in the Lawson common lounge, it is 3:30PM on a Tuesday, you invite the next student from the BoilerQ, who is stuck on a homework assignment due on Thursday. The student appears to be in a pretty happy mood, and there are no other students after her.', '33333333-cccc-cccc-cccc-333333333333', NULL, NULL, 1, 'junior', ARRAY[]::UUID[], false),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'HAAS 11th Hour', 'You are in the HAAS basement, it is 5:30PM on a Friday, and some kid approaches you, visibly agitated, about the homework assignment he is stuck on, and has not started, which is due later tonight, and there are a ton of students waiting for help after him.', '11111111-aaaa-aaaa-aaaa-111111111111', NULL, 9, NULL, 'freshman', ARRAY[]::UUID[], false),
  ('33333333-cccc-cccc-cccc-333333333333', 'DSAI Concept Assistance', 'You are in the Data Science and AI building basement, and a student approaches you with a confused facial expression about a PSO question that was just shown in class. There are 2 other students after him who need help on homework assignment.', '33333333-cccc-cccc-cccc-333333333333', NULL, 5, NULL, 'sophomore', ARRAY[]::UUID[], false),
  ('44444444-dddd-dddd-dddd-444444444444', 'Proof by Induction', 'A student sits confidently with their proof draft, asking for confirmation on their inductive step for summations.', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-2222-2222-2222-222222222222', 2, 3, 'junior', ARRAY[]::UUID[], false),
  ('55555555-eeee-eeee-eeee-555555555555', 'Pigeonhole Principle', 'A student paces back and forth, perplexed about applying the pigeonhole principle to their combinatorics problem.', '33333333-cccc-cccc-cccc-333333333333', '55555555-2222-2222-2222-222222222222', 1, 4, 'sophomore', ARRAY[]::UUID[], false),
  ('66666666-ffff-ffff-ffff-666666666666', 'Finite Automata Diagram', 'An enthusiastic student draws state diagrams on the whiteboard, seeking advice on minimizing states in their DFA.', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-2222-2222-2222-222222222222', 3, 2, 'junior', ARRAY[]::UUID[], false),
  ('77777777-aaaa-bbbb-cccc-777777777777', 'Hash Table Collision', 'A student looks frustrated at their printed hash table output, unsure why multiple keys map to the same bucket.', '11111111-aaaa-aaaa-aaaa-111111111111', '66666666-3333-3333-3333-333333333333', 2, 4, 'sophomore', ARRAY[]::UUID[], false),
  ('88888888-bbbb-cccc-dddd-888888888888', 'Dijkstra Implementation', 'A student proudly shows their weighted graph code, asking if their priority queue usage is optimal.', '22222222-bbbb-bbbb-bbbb-222222222222', '77777777-4444-4444-4444-444444444444', 1, 3, 'senior', ARRAY[]::UUID[], false),
  ('99999999-cccc-dddd-eeee-999999999999', 'Recursive Tree Traversal', 'A student frowns while tracing recursion on paper, confused by the difference between pre- and post-order.', '33333333-cccc-cccc-cccc-333333333333', '66666666-3333-3333-3333-333333333333', 2, 5, 'freshman', ARRAY[]::UUID[], false),
  ('aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', 'Recurrence Relations', 'A student is eager to verify their Master Theorem application to the recurrence for merge sort.', '22222222-bbbb-bbbb-bbbb-222222222222', '77777777-4444-4444-4444-444444444444', 1, 2, 'senior', ARRAY[]::UUID[], false),
  ('bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', 'NP-Completeness', 'A student sits back with their arms crossed, skeptical about why SAT reduces to 3-SAT.', '11111111-aaaa-aaaa-aaaa-111111111111', '77777777-4444-4444-4444-444444444444', 3, 4, 'senior', ARRAY[]::UUID[], false),
  ('cccccccc-ffff-aaaa-bbbb-cccccccccccc', 'Dynamic Programming', 'A student smiles warmly, proud of their bottom-up DP table for the knapsack problem, seeking edge-case checks.', '22222222-bbbb-bbbb-bbbb-222222222222', '77777777-4444-4444-4444-444444444444', 2, 2, 'junior', ARRAY[]::UUID[], false);

-- Insert Practice Scenarios (for individual practice without specific scenarios)
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, seniority, documents, default_scenario) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444444', 'Aggressive Scenario', '', '11111111-aaaa-aaaa-aaaa-111111111111', NULL, NULL, NULL, NULL, NULL, true),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'Happy Scenario', '', '22222222-bbbb-bbbb-bbbb-222222222222', NULL, NULL, NULL, NULL, NULL, true),
  ('cccccccc-1111-2222-3333-444444444444', 'Confused Scenario', '', '33333333-cccc-cccc-cccc-333333333333', NULL, NULL, NULL, NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;

