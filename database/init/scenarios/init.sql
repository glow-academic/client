-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE seniority_levels AS ENUM ('freshman', 'sophomore', 'junior', 'senior');
  
CREATE TABLE scenarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  agent_id UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE,
  crowdedness INTEGER     NOT NULL,
  intensity INTEGER     NOT NULL,
  seniority seniority_levels NOT NULL             DEFAULT 'freshman'
);

-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert Essential Scenarios (around 10 diverse scenarios)
INSERT INTO scenarios (id, name, description, agent_id, crowdedness, intensity, seniority) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'NullPointer Exception', 'A student storms in holding their Java console output, annoyed by a runtime error they can''t trace in their GUI project.', '11111111-aaaa-aaaa-aaaa-111111111111', 3, 4, 'sophomore'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'File I/O Issues', 'A student timidly approaches, worried they''ve overwritten their data file while implementing file read/write methods.', '22222222-bbbb-bbbb-bbbb-222222222222', 2, 2, 'freshman'),
  ('33333333-cccc-cccc-cccc-333333333333', 'Subclass Constructors', 'A student beams in excitedly, eager to understand how to call superclass constructors in their subclass design.', '33333333-cccc-cccc-cccc-333333333333', 1, 5, 'freshman'),
  ('44444444-dddd-dddd-dddd-444444444444', 'Proof by Induction', 'A student sits confidently with their proof draft, asking for confirmation on their inductive step for summations.', '22222222-bbbb-bbbb-bbbb-222222222222', 2, 3, 'junior'),
  ('55555555-eeee-eeee-eeee-555555555555', 'Pigeonhole Principle', 'A student paces back and forth, perplexed about applying the pigeonhole principle to their combinatorics problem.', '33333333-cccc-cccc-cccc-333333333333', 1, 4, 'sophomore'),
  ('66666666-ffff-ffff-ffff-666666666666', 'Finite Automata Diagram', 'An enthusiastic student draws state diagrams on the whiteboard, seeking advice on minimizing states in their DFA.', '22222222-bbbb-bbbb-bbbb-222222222222', 3, 2, 'junior'),
  ('77777777-aaaa-bbbb-cccc-777777777777', 'Hash Table Collision', 'A student looks frustrated at their printed hash table output, unsure why multiple keys map to the same bucket.', '11111111-aaaa-aaaa-aaaa-111111111111', 2, 4, 'sophomore'),
  ('88888888-bbbb-cccc-dddd-888888888888', 'Dijkstra Implementation', 'A student proudly shows their weighted graph code, asking if their priority queue usage is optimal.', '22222222-bbbb-bbbb-bbbb-222222222222', 1, 3, 'senior'),
  ('99999999-cccc-dddd-eeee-999999999999', 'Recursive Tree Traversal', 'A student frowns while tracing recursion on paper, confused by the difference between pre- and post-order.', '33333333-cccc-cccc-cccc-333333333333', 2, 5, 'freshman'),
  ('aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', 'Recurrence Relations', 'A student is eager to verify their Master Theorem application to the recurrence for merge sort.', '22222222-bbbb-bbbb-bbbb-222222222222', 1, 2, 'senior'),
  ('bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', 'NP-Completeness', 'A student sits back with their arms crossed, skeptical about why SAT reduces to 3-SAT.', '11111111-aaaa-aaaa-aaaa-111111111111', 3, 4, 'senior'),
  ('cccccccc-ffff-aaaa-bbbb-cccccccccccc', 'Dynamic Programming', 'A student smiles warmly, proud of their bottom-up DP table for the knapsack problem, seeking edge-case checks.', '22222222-bbbb-bbbb-bbbb-222222222222', 2, 2, 'junior');

-- Insert Practice Scenarios (for individual practice without specific scenarios)
INSERT INTO scenarios (id, name, description, agent_id, crowdedness, intensity, seniority) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444444', 'Aggressive Student Practice', 'Practice session with an aggressive student personality', '11111111-aaaa-aaaa-aaaa-111111111111', 3, 4, 'sophomore'),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'Happy Student Practice', 'Practice session with a positive and encouraging student', '22222222-bbbb-bbbb-bbbb-222222222222', 2, 2, 'freshman'),
  ('cccccccc-1111-2222-3333-444444444444', 'Confused Student Practice', 'Practice session with a confused student who asks many questions', '33333333-cccc-cccc-cccc-333333333333', 1, 5, 'freshman')
ON CONFLICT (id) DO NOTHING;
