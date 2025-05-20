-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- custom enum for chat "profiles"
CREATE TYPE chat_profile AS ENUM ('aggressive', 'happy', 'confused');

CREATE TABLE classes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,  
  class_code TEXT        NOT NULL,
  description TEXT        NOT NULL
);

-- 1) users table
CREATE TABLE users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viewed_intro BOOLEAN     NOT NULL           DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  admin      BOOLEAN     NOT NULL           DEFAULT FALSE,
  name       TEXT        NOT NULL,
  username   TEXT        NOT NULL UNIQUE,
  password   TEXT        NOT NULL,
  classes    UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[]
);

-- 2) chats table
CREATE TABLE chats (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  completed_at TIMESTAMPTZ  NULL,
  title      TEXT         NOT NULL,
  scenario_description TEXT         NOT NULL,
  completed  BOOLEAN      NOT NULL           DEFAULT FALSE,
  user_id    UUID         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  profile    chat_profile NOT NULL,
  class_id   UUID         NOT NULL REFERENCES classes(id)  ON DELETE CASCADE
);

-- 3) messages table
CREATE TABLE messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  chat_id    UUID        NOT NULL REFERENCES chats(id)  ON DELETE CASCADE,
  query      TEXT        NOT NULL,
  response   TEXT        NOT NULL,
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE
);

-- 4) rubrics table
CREATE TABLE rubrics (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID        NOT NULL REFERENCES chats(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  passed     BOOLEAN     NOT NULL,
  score      INTEGER     NOT NULL,
  time_taken INTEGER     NOT NULL, -- in seconds
  adaptability INTEGER     NOT NULL, -- 1-5
  adaptability_feedback TEXT,
  listening INTEGER     NOT NULL, -- 1-5
  listening_feedback TEXT,
  objectives INTEGER     NOT NULL, -- 1-5
  objectives_feedback TEXT,
  time_management INTEGER     NOT NULL, -- 1-5
  time_management_feedback TEXT
);

-- 5) documents table
CREATE TABLE documents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  file_path  TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  profile    chat_profile NOT NULL
);

-- Insert Classes
INSERT INTO classes (id, name, class_code, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Problem Solving And Object-Oriented Programming', 'CS 180', 'Problem solving and algorithms, implementation of algorithms in a high level programming language, conditionals, the iterative approach and debugging, collections of data, searching and sorting, solving problems by decomposition, the object-oriented approach, subclasses of existing classes, handling exceptions that occur when the program is running, graphical user interfaces (GUIs), data stored in files, abstract data types, a glimpse at topics from other CS courses.'),
  ('22222222-2222-2222-2222-222222222222', 'Foundations Of Computer Science', 'CS 182', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.'),
  ('33333333-3333-3333-3333-333333333333', 'Data Structures And Algorithms', 'CS 251', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.'),
  ('44444444-4444-4444-4444-444444444444', 'Introduction To The Analysis Of Algorithms', 'CS 381', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.');

-- Insert Users (15 students + 1 admin)
INSERT INTO users (id, viewed_intro, admin, name, username, password, classes) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, 'Admin User', 'admin_user', 'hashed_password_1', ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::UUID[]),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, false, 'John Doe', 'john_doe', 'hashed_password_2', ARRAY['11111111-1111-1111-1111-111111111111']::UUID[]),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', false, false, 'Jane Smith', 'jane_smith', 'hashed_password_3', ARRAY['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']::UUID[]),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', true, false, 'Bob Wilson', 'bob_wilson', 'hashed_password_4', ARRAY['22222222-2222-2222-2222-222222222222']::UUID[]),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, false, 'Sarah Jones', 'sarah_jones', 'hashed_password_5', ARRAY['11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333']::UUID[]),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', true, false, 'Michael Brown', 'michael_brown', 'hashed_password_6', ARRAY['11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444']::UUID[]),
  ('12345678-abcd-efab-cdef-123456789abc', false, false, 'Emily Davis', 'emily_davis', 'hashed_password_7', ARRAY['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::UUID[]),
  ('87654321-dcba-fedc-baef-987654321cba', true, false, 'David Miller', 'david_miller', 'hashed_password_8', ARRAY['33333333-3333-3333-3333-333333333333']::UUID[]),
  ('abcdef12-3456-7890-abcd-ef1234567890', false, false, 'Lisa Anderson', 'lisa_anderson', 'hashed_password_9', ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::UUID[]),
  ('12ab34cd-56ef-78ab-90cd-12ef34567890', true, false, 'Robert Taylor', 'robert_taylor', 'hashed_password_10', ARRAY['44444444-4444-4444-4444-444444444444']::UUID[]),
  ('abcd1234-efab-cdef-abcd-123456abcdef', false, false, 'Jennifer White', 'jennifer_white', 'hashed_password_11', ARRAY['22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444']::UUID[]),
  ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', true, false, 'William Johnson', 'william_johnson', 'hashed_password_12', ARRAY['11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333']::UUID[]);

INSERT INTO chats (id, created_at, completed_at, title, scenario_description, completed, user_id, profile, class_id) VALUES
  -- CS 180 (Problem Solving And Object-Oriented Programming)
  ('f1e2d3c4-b5a6-47f8-9e00-111111111111', NOW() - INTERVAL '2 hours', NULL, 'NullPointer Exception', 'A student storms in holding their Java console output, annoyed by a runtime error they can''t trace in their GUI project.', false, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aggressive', '11111111-1111-1111-1111-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-222222222222', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'File I/O Issues', 'A student timidly approaches, worried they''ve overwritten their data file while implementing file read/write methods.', true, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'confused', '11111111-1111-1111-1111-111111111111'),
  ('f1e2d3c4-b5a6-47f8-9e00-333333333333', NOW() - INTERVAL '3 hours', NULL, 'Subclass Constructors', 'A student beams in excitedly, eager to understand how to call superclass constructors in their subclass design.', false, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'happy', '11111111-1111-1111-1111-111111111111'),

  -- CS 182 (Foundations Of Computer Science)  
  ('f1e2d3c4-b5a6-47f8-9e00-444444444444', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 'Proof by Induction', 'A student sits confidently with their proof draft, asking for confirmation on their inductive step for summations.', true, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'happy', '22222222-2222-2222-2222-222222222222'),
  ('f1e2d3c4-b5a6-47f8-9e00-555555555555', NOW() - INTERVAL '6 hours', NULL, 'Pigeonhole Principle', 'A student paces back and forth, perplexed about applying the pigeonhole principle to their combinatorics problem.', false, 'abcdef12-3456-7890-abcd-ef1234567890', 'confused', '22222222-2222-2222-2222-222222222222'),
  ('f1e2d3c4-b5a6-47f8-9e00-666666666666', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', 'Finite Automata Diagram', 'An enthusiastic student draws state diagrams on the whiteboard, seeking advice on minimizing states in their DFA.', true, 'abcd1234-efab-cdef-abcd-123456abcdef', 'happy', '22222222-2222-2222-2222-222222222222'),

  -- CS 251 (Data Structures And Algorithms)
  ('f1e2d3c4-b5a6-47f8-9e00-777777777777', NOW() - INTERVAL '4 hours', NULL, 'Hash Table Collision', 'A student looks frustrated at their printed hash table output, unsure why multiple keys map to the same bucket.', false, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'confused', '33333333-3333-3333-3333-333333333333'),
  ('f1e2d3c4-b5a6-47f8-9e00-888888888888', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Dijkstra Implementation', 'A student proudly shows their weighted graph code, asking if their priority queue usage is optimal.', true, '87654321-dcba-fedc-baef-987654321cba', 'happy', '33333333-3333-3333-3333-333333333333'),
  ('f1e2d3c4-b5a6-47f8-9e00-999999999999', NOW() - INTERVAL '1 hour', NULL, 'Recursive Tree Traversal', 'A student frowns while tracing recursion on paper, confused by the difference between pre- and post-order.', false, 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'confused', '33333333-3333-3333-3333-333333333333'),

  -- CS 381 (Introduction To The Analysis Of Algorithms)
  ('f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', 'Recurrence Relations', 'A student is eager to verify their Master Theorem application to the recurrence for merge sort.', true, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'happy', '44444444-4444-4444-4444-444444444444'),
  ('f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb', NOW() - INTERVAL '5 hours', NULL, 'NP-Completeness', 'A student sits back with their arms crossed, skeptical about why SAT reduces to 3-SAT.', false, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'aggressive', '44444444-4444-4444-4444-444444444444'),
  ('f1e2d3c4-b5a6-47f8-9e00-cccccccccccc', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Dynamic Programming', 'A student smiles warmly, proud of their bottom-up DP table for the knapsack problem, seeking edge-case checks.', true, '12ab34cd-56ef-78ab-90cd-12ef34567890', 'happy', '44444444-4444-4444-4444-444444444444'),

  -- Sarah Jones (CS 180)
  ('aaaaaaaa-1111-2222-3333-444444444441', NOW() - INTERVAL '30 minutes', NULL, 'Infinite Loop', 'A student looks exasperated, explaining they can''t exit their while loop even after adding a break.', false, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'confused', '11111111-1111-1111-1111-111111111111'),
  -- Michael Brown (CS 381)
  ('aaaaaaaa-1111-2222-3333-444444444442', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Master Theorem Edge Case', 'A student frowns over a whiteboard derivation, unsure how to handle non-polynomial terms.', true, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'confused', '44444444-4444-4444-4444-444444444444'),
  -- Emily Davis (CS 251)
  ('aaaaaaaa-1111-2222-3333-444444444443', NOW() - INTERVAL '3 hours', NULL, 'Balancing BST', 'An eager student sketches rotations on paper, asking why their tree stays unbalanced.', false, '12345678-abcd-efab-cdef-123456789abc', 'happy', '33333333-3333-3333-3333-333333333333'),
  -- David Miller (CS 251)
  ('aaaaaaaa-1111-2222-3333-444444444444', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours', 'Adjacency List', 'A student timidly shows their graph struct, worried about extra memory overhead.', true, '87654321-dcba-fedc-baef-987654321cba', 'confused', '33333333-3333-3333-3333-333333333333'),
  -- Lisa Anderson (CS 182)
  ('aaaaaaaa-1111-2222-3333-444444444445', NOW() - INTERVAL '1 day', NULL, 'Set Theory Paradox', 'A student nervously describes Cantor''s diagonal argument, puzzled by cardinality implications.', false, 'abcdef12-3456-7890-abcd-ef1234567890', 'confused', '22222222-2222-2222-2222-222222222222'),
  -- Robert Taylor (CS 381)
  ('aaaaaaaa-1111-2222-3333-444444444446', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours', 'Branch and Bound', 'A student smiles broadly while outlining their branch-and-bound tree for TSP.', true, '12ab34cd-56ef-78ab-90cd-12ef34567890', 'happy', '44444444-4444-4444-4444-444444444444'),
  -- Jennifer White (CS 182)
  ('aaaaaaaa-1111-2222-3333-444444444447', NOW() - INTERVAL '4 days', NULL, 'Proof by Contradiction', 'A student sits forward, confident in their plan but wants to verify the negation step.', false, 'abcd1234-efab-cdef-abcd-123456abcdef', 'happy', '22222222-2222-2222-2222-222222222222'),
  -- William Johnson (CS 180)
  ('aaaaaaaa-1111-2222-3333-444444444448', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours', 'Interface Design', 'A student enthusiastically shares UML for their new Shape interface hierarchy.', true, 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'happy', '11111111-1111-1111-1111-111111111111'),
  -- Jane Smith (CS 381)
  ('aaaaaaaa-1111-2222-3333-444444444449', NOW() - INTERVAL '7 days', NULL, 'Polynomial Reduction', 'A student appears skeptical, asking why we reduce 3-SAT to CLIQUE instead of vice versa.', false, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aggressive', '44444444-4444-4444-4444-444444444444'),
  -- Bob Wilson (CS 182)
  ('aaaaaaaa-1111-2222-3333-444444444450', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Recursion vs Iteration', 'A student leans over their notes, curious whether tail recursion offers any performance gains in Python.', true, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'confused', '22222222-2222-2222-2222-222222222222'),
  -- Sarah Jones (CS 180)
  ('55555555-aaaa-bbbb-cccc-111111111111', NOW() - INTERVAL '1 day', NULL, 'Garbage Collection', 'A student nervously describes unexpected object retention in their Java program and worries about memory leaks.', false, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'confused', '11111111-1111-1111-1111-111111111111'),
  
  -- Michael Brown (CS 381)
  ('55555555-aaaa-bbbb-cccc-222222222222', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Amortized Analysis', 'A student smiles, proud of their aggregate analysis on dynamic array resizing, and asks for validation.', true, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'happy', '44444444-4444-4444-4444-444444444444'),
  
  -- Emily Davis (CS 251)
  ('55555555-aaaa-bbbb-cccc-333333333333', NOW() - INTERVAL '3 days', NULL, 'Graph Traversal', 'A student frowns, struggling to implement BFS with correct visited tracking.', false, '12345678-abcd-efab-cdef-123456789abc', 'confused', '33333333-3333-3333-3333-333333333333'),
  
  -- David Miller (CS 251)
  ('55555555-aaaa-bbbb-cccc-444444444444', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', 'Stack Overflow', 'A student looks frustrated at a runtime crash and suspects infinite recursion in their tree walk.', false, '87654321-dcba-fedc-baef-987654321cba', 'aggressive', '33333333-3333-3333-3333-333333333333'),
  
  -- Lisa Anderson (CS 182)
  ('55555555-aaaa-bbbb-cccc-555555555555', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Lambda Expressions', 'A student raises a hand, asking how to translate logical quantifiers into lambda calculus notation.', true, 'abcdef12-3456-7890-abcd-ef1234567890', 'happy', '22222222-2222-2222-2222-222222222222'),
  
  -- Robert Taylor (CS 381)
  ('55555555-aaaa-bbbb-cccc-666666666666', NOW() - INTERVAL '3 days', NULL, 'Deadlock Detection', 'A student sits back in chair, arms folded, challenging the necessity of the banker''s algorithm for their assignment.', false, '12ab34cd-56ef-78ab-90cd-12ef34567890', 'aggressive', '44444444-4444-4444-4444-444444444444'),
  
  -- Jennifer White (CS 182)
  ('55555555-aaaa-bbbb-cccc-777777777777', NOW() - INTERVAL '6 hours', NULL, 'State Minimization', 'A student draws DFA states on paper, puzzled why two states aren''t merging.', false, 'abcd1234-efab-cdef-abcd-123456abcdef', 'confused', '22222222-2222-2222-2222-222222222222'),
  
  -- William Johnson (CS 180)
  ('55555555-aaaa-bbbb-cccc-888888888888', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', 'Interface Segregation', 'A student excitedly presents their refactored interfaces, eager for feedback on SOLID principles.', true, 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'happy', '11111111-1111-1111-1111-111111111111'),
  
  -- John Doe (CS 180)
  ('55555555-aaaa-bbbb-cccc-999999999999', NOW() - INTERVAL '2 days', NULL, 'Exception Chaining', 'A student looks weary, asking how to propagate exceptions properly without losing stack traces.', false, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'confused', '11111111-1111-1111-1111-111111111111'),
  
  -- Jane Smith (CS 381)
  ('55555555-aaaa-bbbb-cccc-000000000000', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 'Heuristic Search', 'A student leans forward, debating A* heuristics admissibility and consistency in pathfinding.', true, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'happy', '44444444-4444-4444-4444-444444444444'),
  
  ('66666666-aaaa-bbbb-cccc-111111111111', NOW() - INTERVAL '1 day', NULL, 'Array Index Out of Bounds', 'A student frowns at their console dump, perplexed why accessing element 10 in a size-10 array crashes their program.', false, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'confused', '11111111-1111-1111-1111-111111111111'),
  ('66666666-aaaa-bbbb-cccc-222222222222', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', 'Generics Syntax', 'A student smiles, proud of their List<String> implementation, and asks how to apply multiple bounds.', true, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'happy', '11111111-1111-1111-1111-111111111111'),
  ('66666666-aaaa-bbbb-cccc-333333333333', NOW() - INTERVAL '2 days', NULL, 'Graph Isomorphism', 'A student sits back skeptically, questioning if two adjacency lists truly represent the same graph.', false, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aggressive', '22222222-2222-2222-2222-222222222222'),
  ('66666666-aaaa-bbbb-cccc-444444444444', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Regular Expressions', 'An eager student presents their regex for matching binary strings and asks why it sometimes overmatches.', true, 'abcdef12-3456-7890-abcd-ef1234567890', 'confused', '22222222-2222-2222-2222-222222222222'),
  ('66666666-aaaa-bbbb-cccc-555555555555', NOW() - INTERVAL '5 hours', NULL, 'Priority Queue Interface', 'A student appears puzzled by why their custom PQ doesn''t implement Comparator correctly, causing runtime errors.', false, '12345678-abcd-efab-cdef-123456789abc', 'confused', '33333333-3333-3333-3333-333333333333'),
  ('66666666-aaaa-bbbb-cccc-666666666666', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', 'Topological Sort', 'A student beams at their DAG implementation, asking if there''s a more efficient way to detect cycles first.', true, '87654321-dcba-fedc-baef-987654321cba', 'happy', '33333333-3333-3333-3333-333333333333'),
  ('66666666-aaaa-bbbb-cccc-777777777777', NOW() - INTERVAL '3 days', NULL, 'Space Complexity', 'A student leans over their notes, worried their O(n²) solution will exceed memory limits for n = 1e6.', false, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'confused', '44444444-4444-4444-4444-444444444444'),
  ('66666666-aaaa-bbbb-cccc-888888888888', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Approximation Algorithms', 'A student describes their greedy vertex cover approach and asks how to prove its approximation ratio.', true, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'happy', '44444444-4444-4444-4444-444444444444'),
  ('66666666-aaaa-bbbb-cccc-999999999999', NOW() - INTERVAL '5 days', NULL, 'Randomized Algorithms', 'A student raises an eyebrow, challenging why quicksort''s randomized pivot yields expected O(n log n) time.', false, '12ab34cd-56ef-78ab-90cd-12ef34567890', 'aggressive', '44444444-4444-4444-4444-444444444444'),
  ('66666666-aaaa-bbbb-cccc-000000000000', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', 'Recursive Definitions', 'A student nods while writing down a recurrence for the Fibonacci sequence and asks about tail-recursive optimization.', true, 'abcd1234-efab-cdef-abcd-123456abcdef', 'happy', '22222222-2222-2222-2222-222222222222');

-- Insert Rubrics (for completed chats)
INSERT INTO rubrics (chat_id, passed, score, time_taken, adaptability, adaptability_feedback, listening, listening_feedback, objectives, objectives_feedback, time_management, time_management_feedback) VALUES
  -- File I/O Issues
  ('f1e2d3c4-b5a6-47f8-9e00-222222222222', true, 16, 720, 4, 'Adapted well to the student''s confusion but could have simplified explanations further', 5, 'Excellent active listening, identified the root cause quickly', 4, 'Successfully helped student recover data and implement proper file handling', 3, 'Session ran longer than necessary due to tangential explanations'),
  
  -- Proof by Induction
  ('f1e2d3c4-b5a6-47f8-9e00-444444444444', true, 18, 540, 5, 'Excellent adaptation to student''s confidence level, providing just the right amount of guidance', 4, 'Good listening but occasionally missed subtle questions', 5, 'Thoroughly validated proof and strengthened student''s understanding', 4, 'Efficient session with good pacing'),
  
  -- Finite Automata Diagram
  ('f1e2d3c4-b5a6-47f8-9e00-666666666666', true, 17, 630, 4, 'Adapted teaching style to match student''s visual learning preference', 5, 'Excellent attention to student''s specific questions about state minimization', 4, 'Successfully helped optimize the DFA design', 4, 'Good time management with appropriate focus on key concepts'),
  
  -- Dijkstra Implementation
  ('f1e2d3c4-b5a6-47f8-9e00-888888888888', true, 20, 480, 5, 'Perfectly matched technical depth to student''s knowledge level', 5, 'Exceptional listening, identified optimization opportunities beyond student''s questions', 5, 'Provided optimal solution and explained time/space complexity tradeoffs', 5, 'Excellent pacing, covered all aspects efficiently'),
  
  -- Recurrence Relations
  ('f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa', true, 18, 540, 4, 'Good adaptation to student''s mathematical background', 5, 'Excellent active listening, clarified misconceptions about Master Theorem application', 5, 'Successfully verified and improved student''s recurrence analysis', 4, 'Good time management but spent too long on basic concepts'),
  
  -- Dynamic Programming
  ('f1e2d3c4-b5a6-47f8-9e00-cccccccccccc', true, 18, 600, 5, 'Excellent adaptation to student''s enthusiasm, building on their existing knowledge', 4, 'Good listening but occasionally missed opportunities to praise student''s work', 5, 'Thoroughly validated solution and identified all edge cases', 4, 'Efficient session with appropriate depth'),
  
  -- Master Theorem Edge Case
  ('aaaaaaaa-1111-2222-3333-444444444442', true, 16, 780, 4, 'Adapted well to student''s confusion about non-polynomial terms', 4, 'Good listening but occasionally missed subtle points of confusion', 5, 'Successfully clarified complex mathematical concepts', 3, 'Session ran longer than necessary due to tangential explanations'),
  
  -- Adjacency List
  ('aaaaaaaa-1111-2222-3333-444444444444', true, 15, 660, 3, 'Somewhat rigid approach to explaining memory optimization', 4, 'Good listening to student''s concerns about memory overhead', 4, 'Successfully addressed memory concerns and suggested alternatives', 4, 'Good time management with appropriate focus on implementation details'),
  
  -- Branch and Bound
  ('aaaaaaaa-1111-2222-3333-444444444446', true, 18, 540, 5, 'Excellent adaptation to student''s enthusiasm, providing advanced insights', 4, 'Good listening but occasionally interrupted student''s explanations', 5, 'Provided valuable feedback on TSP implementation and pruning strategies', 4, 'Efficient session with good balance of theory and practice'),
  
  -- Interface Design
  ('aaaaaaaa-1111-2222-3333-444444444448', true, 19, 660, 5, 'Excellent adaptation to student''s design-oriented thinking', 5, 'Exceptional listening, built upon student''s UML design effectively', 5, 'Provided valuable insights on SOLID principles and interface design', 4, 'Good pacing but could have been more concise in some explanations'),
  
  -- Recursion vs Iteration
  ('aaaaaaaa-1111-2222-3333-444444444450', true, 17, 720, 4, 'Good adaptation to student''s curiosity about language-specific optimizations', 5, 'Excellent listening, addressed nuanced questions about tail recursion', 4, 'Successfully explained performance differences between Python and other languages', 4, 'Good time management with appropriate depth'),
  
  -- Amortized Analysis
  ('55555555-aaaa-bbbb-cccc-222222222222', true, 20, 480, 5, 'Excellent adaptation to student''s mathematical background', 5, 'Exceptional listening, validated student''s work while offering improvements', 5, 'Provided insightful feedback on aggregate analysis approach', 5, 'Excellent pacing and focus throughout the session'),
  
  -- Lambda Expressions
  ('55555555-aaaa-bbbb-cccc-555555555555', true, 17, 600, 4, 'Good adaptation to student''s theoretical background', 4, 'Good listening but occasionally missed opportunities to check understanding', 5, 'Successfully translated logical quantifiers to lambda calculus', 4, 'Good time management with appropriate depth'),
  
  -- Interface Segregation
  ('55555555-aaaa-bbbb-cccc-888888888888', true, 20, 540, 5, 'Excellent adaptation to student''s design-oriented thinking', 5, 'Exceptional listening, built upon student''s understanding of SOLID principles', 5, 'Provided valuable feedback on interface segregation implementation', 5, 'Excellent pacing and focus throughout the session'),
  
  -- Heuristic Search
  ('55555555-aaaa-bbbb-cccc-000000000000', true, 18, 660, 5, 'Excellent adaptation to student''s theoretical questions', 4, 'Good listening but occasionally missed opportunities to explore student''s insights', 5, 'Successfully clarified A* heuristic properties and implementation considerations', 4, 'Good time management with appropriate theoretical depth'),
  
  -- Generics Syntax
  ('66666666-aaaa-bbbb-cccc-222222222222', true, 18, 480, 4, 'Good adaptation to student''s Java knowledge level', 5, 'Excellent listening, addressed specific questions about multiple bounds', 5, 'Successfully explained advanced generics concepts and implementation', 4, 'Efficient session with good focus on practical application'),
  
  -- Regular Expressions
  ('66666666-aaaa-bbbb-cccc-444444444444', true, 15, 720, 3, 'Somewhat rigid in explanation approach', 4, 'Good listening to student''s specific regex issues', 4, 'Successfully identified and fixed overmatching problem', 4, 'Session could have been more efficient with better examples'),
  
  -- Topological Sort
  ('66666666-aaaa-bbbb-cccc-666666666666', true, 20, 540, 5, 'Excellent adaptation to student''s algorithm knowledge', 5, 'Exceptional listening, addressed both explicit and implicit questions', 5, 'Provided optimal cycle detection strategy and implementation guidance', 5, 'Excellent pacing and focus throughout the session'),
  
  -- Approximation Algorithms
  ('66666666-aaaa-bbbb-cccc-888888888888', true, 18, 600, 5, 'Excellent adaptation to student''s theoretical background', 4, 'Good listening but occasionally missed opportunities to check understanding', 5, 'Successfully explained approximation ratio proof techniques', 4, 'Good time management with appropriate theoretical depth'),
  
  -- Recursive Definitions
  ('66666666-aaaa-bbbb-cccc-000000000000', true, 18, 540, 4, 'Good adaptation to student''s interest in optimization', 5, 'Excellent listening, addressed specific questions about tail recursion', 4, 'Successfully explained recursive optimization techniques', 5, 'Excellent pacing, covered all aspects efficiently');
