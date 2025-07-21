-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================


CREATE TABLE scenario_locations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL
);

CREATE TABLE scenario_deadlines (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  deadline TEXT     NOT NULL,
  description TEXT     NOT NULL
);

CREATE TABLE scenario_times (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  time_of_day TIME     NOT NULL,
  description TEXT     NOT NULL
);
  
CREATE TABLE scenarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  agent_id UUID         NULL REFERENCES agents(id)  ON DELETE SET NULL DEFAULT NULL,
  class_id   UUID        NULL REFERENCES classes(id) ON DELETE SET NULL DEFAULT NULL,
  crowdedness INTEGER     NULL DEFAULT NULL,
  intensity INTEGER     NULL DEFAULT NULL,
  location_id UUID        NULL REFERENCES scenario_locations(id) ON DELETE SET NULL DEFAULT NULL,
  deadline_id UUID        NULL REFERENCES scenario_deadlines(id) ON DELETE SET NULL DEFAULT NULL,
  time_id UUID        NULL REFERENCES scenario_times(id) ON DELETE SET NULL DEFAULT NULL, 
  document_ids UUID[] NULL DEFAULT NULL, 
  default_scenario BOOLEAN     NOT NULL DEFAULT FALSE,
  practice_scenario BOOLEAN     NOT NULL DEFAULT FALSE,
  generated BOOLEAN     NOT NULL DEFAULT FALSE,
  parent_id UUID        NULL DEFAULT NULL
);

  INSERT INTO scenario_locations (id, name, description) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Lawson', 'An open, collaborative space in the Lawson building with high foot traffic.'),
    ('22222222-2222-2222-2222-222222222222', 'HAAS', 'A quiet, focused study environment in the lower level of the HAAS building.'),
    ('33333333-3333-3333-3333-333333333333', 'DSAI', 'A specialized tech-focused lab environment in the basement of the Data Science/AI building.');

INSERT INTO scenario_deadlines (id, deadline, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Few hours', 'This is a high-stress situation requiring immediate help'),
  ('22222222-2222-2222-2222-222222222222', 'Next day', 'This is a moderate stress situation requiring immediate help'),
  ('33333333-3333-3333-3333-333333333333', 'Couple of days', 'This is a low stress situation requiring immediate help');

INSERT INTO scenario_times (id, time_of_day, description) VALUES
  ('11111111-1111-1111-1111-111111111111', '09:00:00', 'Early morning session, students may be tired but focused'),
  ('22222222-2222-2222-2222-222222222222', '10:00:00', 'Mid-morning session, good energy levels'),
  ('33333333-3333-3333-3333-333333333333', '11:00:00', 'Late morning session, students are alert and engaged'),
  ('44444444-4444-4444-4444-444444444444', '12:00:00', 'Lunch time session, students may be hungry or rushed'),
  ('55555555-5555-5555-5555-555555555555', '13:00:00', 'Early afternoon session, post-lunch energy dip possible'),
  ('66666666-6666-6666-6666-666666666666', '14:00:00', 'Mid-afternoon session, good focus time'),
  ('77777777-7777-7777-7777-777777777777', '15:00:00', 'Late afternoon session, sustained energy needed'),
  ('88888888-8888-8888-8888-888888888888', '16:00:00', 'Evening session, students may be tired from the day'),
  ('99999999-9999-9999-9999-999999999999', '17:00:00', 'End of day session, students eager to finish');

-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert Practice Scenarios (for individual practice without specific scenarios)
INSERT INTO scenarios (id, name, description, agent_id, practice_scenario, default_scenario) VALUES
  ('aaaaaaaa-1111-2222-3333-444444444444', 'Aggressive Scenario', '', '11111111-aaaa-aaaa-aaaa-111111111111', true, true),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'Happy Scenario', '', '22222222-bbbb-bbbb-bbbb-222222222222', true, true),
  ('cccccccc-1111-2222-3333-444444444444', 'Confused Scenario', '', '33333333-cccc-cccc-cccc-333333333333', true, true);

-- ============================================================================
-- FALL 2025 W1 TRAINING (BEGINNER) SCENARIOS
-- ============================================================================

-- Basic Student Interaction - Arrays Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2511b01-aaaa-bbbb-cccc-111111111111', 'Array Index Confusion', 'You are in the Lawson Computer Lab at 2 PM on a Tuesday. A student approaches with a bright smile, holding their laptop with a CS 180 array assignment open. They seem excited but confused about why their loop is going out of bounds. There are about 5 other students quietly working nearby.', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-1111-1111-1111-111111111111', 5, 2, '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', ARRAY[]::UUID[], true),
  ('f2511b02-aaaa-bbbb-cccc-222222222222', 'Array Length vs Index', 'You are in the HAAS basement study area at 3 PM on a Wednesday. A student sits down with their printed code, looking puzzled about the difference between array.length and array indices. They have a gentle demeanor but clearly need guidance. About 3 other students are studying at nearby tables.', '33333333-cccc-cccc-cccc-333333333333', '44444444-1111-1111-1111-111111111111', 3, 3, '22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', ARRAY[]::UUID[], true),
  ('f2511b03-aaaa-bbbb-cccc-333333333333', 'Multi-dimensional Array Help', 'You are in the DSAI building common area at 4 PM on a Thursday. A student bounces over with their laptop, excited to show you their 2D array code but confused about row vs column indexing. The area is moderately busy with about 8 students working on various assignments.', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-1111-1111-1111-111111111111', 8, 2, '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', ARRAY[]::UUID[], true);

-- Handling Confused Students - Loops Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2511b04-aaaa-bbbb-cccc-444444444444', 'Infinite Loop Panic', 'You are in the Lawson basement lab at 5 PM on a Friday. A student approaches looking worried, explaining that their while loop keeps running forever and they do not understand why. They seem anxious but willing to learn. About 12 students are around, some working on the same assignment.', '33333333-cccc-cccc-cccc-333333333333', '44444444-1111-1111-1111-111111111111', 10, 4, '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', ARRAY[]::UUID[], true),
  ('f2511b05-aaaa-bbbb-cccc-555555555555', 'For Loop Logic', 'You are in the HAAS computer lab at 1 PM on a Monday. A gentle student sits down with their notebook, confused about when to use for loops versus while loops for their homework. They have a calm demeanor and seem eager to understand. The lab is quiet with only 4 other students present.', '33333333-cccc-cccc-cccc-333333333333', '44444444-1111-1111-1111-111111111111', 4, 2, '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', ARRAY[]::UUID[], true),
  ('f2511b06-aaaa-bbbb-cccc-666666666666', 'Nested Loop Confusion', 'You are in the DSAI basement at 11 AM on a Tuesday. A student approaches with their code printout, trying to understand how nested loops work for processing a 2D array. They are smiling but clearly need step-by-step guidance. About 6 students are working nearby.', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-1111-1111-1111-111111111111', 6, 3, '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', ARRAY[]::UUID[], true);

-- Time Management Practice - File I/O Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2511b07-aaaa-bbbb-cccc-777777777777', 'File Reading Basics', 'You are in the Lawson study lounge at 10 AM on a Wednesday. A cheerful student approaches with their laptop, excited to learn about reading files but completely new to the concept. They seem eager and patient. The lounge is peaceful with about 7 students studying quietly.', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-1111-1111-1111-111111111111', 7, 1, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', ARRAY[]::UUID[], true),
  ('f2511b08-aaaa-bbbb-cccc-888888888888', 'FileNotFoundException Help', 'You are in the HAAS basement at 3 PM on a Thursday. A student sits down looking frustrated with their code that keeps throwing FileNotFoundException errors. They seem overwhelmed but willing to work through it step by step. About 9 students are in the area working on assignments.', '33333333-cccc-cccc-cccc-333333333333', '44444444-1111-1111-1111-111111111111', 9, 4, '22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', ARRAY[]::UUID[], true),
  ('f2511b09-aaaa-bbbb-cccc-999999999999', 'Scanner vs BufferedReader', 'You are in the DSAI computer lab at 2 PM on a Friday. A student approaches with questions about the best way to read files, comparing Scanner and BufferedReader approaches. They are enthusiastic about learning the proper techniques. The lab is moderately busy with about 10 students.', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-1111-1111-1111-111111111111', 10, 2, '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', ARRAY[]::UUID[], true);

-- ============================================================================
-- FALL 2025 W1 TRAINING (ADVANCED) SCENARIOS
-- ============================================================================

-- Graph Theory Tutoring - DFS/BFS Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2511a01-aaaa-bbbb-cccc-111111111111', 'DFS Implementation Challenge', 'You are in the DSAI basement lab at 4 PM on a Monday. A student storms over, frustrated that their DFS implementation is not working correctly and they have been stuck for hours. They seem impatient and want quick answers. About 15 students are working around you, creating a busy atmosphere.', '11111111-aaaa-aaaa-aaaa-111111111111', '66666666-3333-3333-3333-333333333333', 10, 5, '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', ARRAY[]::UUID[], true),
  ('f2511a02-aaaa-bbbb-cccc-222222222222', 'BFS vs DFS Confusion', 'You are in the Lawson computer lab at 5 PM on a Wednesday. A student approaches with their graph traversal code, unable to understand when to use BFS versus DFS for their CS 251 assignment. They seem overwhelmed by the concepts. The lab is packed with about 20 students working on the same assignment.', '33333333-cccc-cccc-cccc-333333333333', '66666666-3333-3333-3333-333333333333', 10, 4, '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', ARRAY[]::UUID[], true),
  ('f2511a03-aaaa-bbbb-cccc-333333333333', 'Graph Representation Issues', 'You are in the HAAS basement at 3 PM on a Thursday. A student approaches, clearly frustrated with implementing adjacency lists versus adjacency matrices for their graph algorithms. They seem impatient and want to understand the trade-offs quickly. About 12 students are nearby working intensely.', '11111111-aaaa-aaaa-aaaa-111111111111', '66666666-3333-3333-3333-333333333333', 10, 5, '22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', ARRAY[]::UUID[], true);

-- Mathematical Induction Practice Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2511a04-aaaa-bbbb-cccc-444444444444', 'Induction Base Case Struggle', 'You are in the DSAI study area at 1 PM on a Tuesday. A student sits down with their CS 182 proof homework, completely lost on how to establish the base case for mathematical induction. They seem frustrated and have been working on this for hours. About 8 students are studying around you.', '33333333-cccc-cccc-cccc-333333333333', '55555555-2222-2222-2222-222222222222', 8, 4, '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', ARRAY[]::UUID[], true),
  ('f2511a05-aaaa-bbbb-cccc-555555555555', 'Inductive Step Logic', 'You are in the Lawson basement at 4 PM on a Friday. A student approaches, clearly agitated about their inductive step not making logical sense. They have the base case but cannot bridge to the general case. The area is busy with about 14 students, many working on proofs.', '11111111-aaaa-aaaa-aaaa-111111111111', '55555555-2222-2222-2222-222222222222', 10, 5, '11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', ARRAY[]::UUID[], true),
  ('f2511a06-aaaa-bbbb-cccc-666666666666', 'Strong vs Weak Induction', 'You are in the HAAS computer lab at 2 PM on a Monday. A student approaches with their discrete math assignment, unable to determine when to use strong induction versus regular induction. They seem overwhelmed by the different proof techniques. About 6 students are working quietly nearby.', '33333333-cccc-cccc-cccc-333333333333', '55555555-2222-2222-2222-222222222222', 6, 4, '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', ARRAY[]::UUID[], true);

-- Advanced Data Structures - Trees Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2511a07-aaaa-bbbb-cccc-777777777777', 'BST Balancing Issues', 'You are in the DSAI basement lab at 5 PM on a Wednesday. A student approaches, visibly frustrated with their binary search tree implementation that keeps becoming unbalanced. They want to understand AVL or Red-Black trees but are getting impatient with the complexity. About 18 students are working intensely around you.', '11111111-aaaa-aaaa-aaaa-111111111111', '66666666-3333-3333-3333-333333333333', 10, 5, '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', ARRAY[]::UUID[], true),
  ('f2511a08-aaaa-bbbb-cccc-888888888888', 'Tree Traversal Algorithms', 'You are in the Lawson study area at 3 PM on a Thursday. A student sits down with their tree traversal code, unable to get their in-order, pre-order, and post-order traversals to work correctly. They seem lost in the recursive logic. About 10 students are studying nearby.', '33333333-cccc-cccc-cccc-333333333333', '66666666-3333-3333-3333-333333333333', 10, 4, '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', ARRAY[]::UUID[], true),
  ('f2511a09-aaaa-bbbb-cccc-999999999999', 'Heap Implementation Challenge', 'You are in the HAAS basement at 1 PM on a Friday. A student approaches, frustrated with implementing a min-heap for their priority queue assignment. They understand the concept but cannot get the parent-child relationships right in their array implementation. About 11 students are working around you.', '11111111-aaaa-aaaa-aaaa-111111111111', '66666666-3333-3333-3333-333333333333', 10, 5, '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', ARRAY[]::UUID[], true);

-- ============================================================================
-- FALL 2025 W2 TRAINING (CS 1XX/2XX) SCENARIOS - DOCUMENT BASED
-- ============================================================================

-- Coding Project OOP Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2522101-aaaa-bbbb-cccc-111111111111', 'OOP Design Patterns', 'You are in the DSAI basement lab at 4 PM on a Tuesday. A student approaches with their CS 180 project requirements, struggling to understand how to properly design classes and inheritance for their object-oriented programming assignment. They have the project document but cannot translate requirements to code. About 13 students are working on similar projects nearby.', '33333333-cccc-cccc-cccc-333333333333', '44444444-1111-1111-1111-111111111111', 10, 4, '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', ARRAY['d0c11111-2222-3333-4444-444444444444']::UUID[], true), -- Document: CS180 Project assignment (Methods and Classes)
  ('f2522102-aaaa-bbbb-cccc-222222222222', 'Interface Implementation', 'You are in the Lawson computer lab at 2 PM on a Thursday. A student approaches with their interfaces and inheritance homework, excited about the concept but confused about when to use interfaces versus abstract classes. They have the assignment document open and are eager to learn. About 7 students are working around you.', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-1111-1111-1111-111111111111', 7, 2, '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', ARRAY['d0c22222-3333-4444-5555-555555555555']::UUID[], true), -- Document: CS180 Homework (Interfaces and Inheritance)
  ('f2522103-aaaa-bbbb-cccc-333333333333', 'Polymorphism Confusion', 'You are in the HAAS basement at 5 PM on a Monday. A student approaches with their polymorphism lab exercise, completely lost about method overriding and dynamic binding. They have the lab document but cannot understand the examples. About 16 students are working intensely on the same lab.', '33333333-cccc-cccc-cccc-333333333333', '44444444-1111-1111-1111-111111111111', 10, 4, '22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', ARRAY['d0c33333-4444-5555-6666-666666666666']::UUID[], true); -- Document: CS180 Lab (Polymorphism, Dynamic Data Structures)

-- Basic Induction & Proofs Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2522104-aaaa-bbbb-cccc-444444444444', 'Proof Technique Selection', 'You are in the DSAI study area at 1 PM on a Wednesday. A student sits down with their CS 182 proof techniques homework, unable to determine which proof method to use for different types of problems. They have the assignment document but are overwhelmed by the options. About 9 students are studying nearby.', '33333333-cccc-cccc-cccc-333333333333', '55555555-2222-2222-2222-222222222222', 9, 4, '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', ARRAY['d0c44444-5555-6666-7777-777777777777']::UUID[], true), -- Document: CS182 Homework (Proof Techniques including Mathematical Induction)
  ('f2522105-aaaa-bbbb-cccc-555555555555', 'Logic Foundations', 'You are in the Lawson basement at 3 PM on a Friday. A student approaches with their basic logic assignment, excited about propositional logic but confused about truth tables and logical equivalences. They have their lecture notes and homework document ready. About 5 students are working quietly around you.', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-2222-2222-2222-222222222222', 5, 2, '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', ARRAY['d0c55555-6666-7777-8888-888888888888']::UUID[], true), -- Document: CS182 Lecture (Basic Logic)
  ('f2522106-aaaa-bbbb-cccc-666666666666', 'Mathematical Language', 'You are in the HAAS computer lab at 11 AM on a Tuesday. A student approaches with their discrete math homework, struggling to understand mathematical notation and formal language used in proofs. They have the textbook and assignment but cannot parse the symbols. About 12 students are working on similar problems.', '33333333-cccc-cccc-cccc-333333333333', '55555555-2222-2222-2222-222222222222', 10, 3, '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', ARRAY['d0c66666-7777-8888-9999-999999999999']::UUID[], true); -- Document: CS182 Lecture (The Language of Mathematics)

-- Data Structures and Algorithms Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2522107-aaaa-bbbb-cccc-777777777777', 'Runtime Analysis Practice', 'You are in the DSAI basement lab at 4 PM on a Thursday. A student approaches with their CS 251 runtime analysis homework, struggling to determine Big-O complexity for different algorithms. They have the assignment document but cannot connect the theory to practice. About 14 students are working on the same problems nearby.', '33333333-cccc-cccc-cccc-333333333333', '66666666-3333-3333-3333-333333333333', 10, 4, '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', ARRAY['d0c77777-8888-9999-aaaa-aaaaaaaaaaaa']::UUID[], true), -- Document: CS251 Midterm topics (Runtime Expressions, Asymptotic Runtime Analysis)
  ('f2522108-aaaa-bbbb-cccc-888888888888', 'Linked List Implementation', 'You are in the Lawson study area at 2 PM on a Monday. A student approaches with their linked list project, excited about the data structure but confused about pointer manipulation and memory management. They have their project specification and are eager to understand. About 8 students are coding around you.', '22222222-bbbb-bbbb-bbbb-222222222222', '66666666-3333-3333-3333-333333333333', 8, 2, '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', ARRAY['d0c88888-9999-aaaa-bbbb-bbbbbbbbbbbb']::UUID[], true), -- Document: CS251 Midterm topics (Arrays and Linked Lists)
  ('f2522109-aaaa-bbbb-cccc-999999999999', 'Binary Tree Operations', 'You are in the HAAS basement at 5 PM on a Wednesday. A student approaches with their binary tree lab, struggling to implement insertion, deletion, and traversal operations correctly. They have the lab document but their recursive thinking is not clicking. About 11 students are working intensely nearby.', '33333333-cccc-cccc-cccc-333333333333', '66666666-3333-3333-3333-333333333333', 10, 4, '22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', ARRAY['d0c99999-aaaa-bbbb-cccc-cccccccccccc']::UUID[], true); -- Document: CS251 Midterm topics (Binary Trees)

-- ============================================================================
-- FALL 2025 W2 TRAINING (CS 3XX/4XX) SCENARIOS - DOCUMENT BASED
-- ============================================================================

-- Analysis of Algorithms Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2522201-aaaa-bbbb-cccc-111111111111', 'Algorithm Complexity Proofs', 'You are in the DSAI basement lab at 4 PM on a Monday. A student approaches, frustrated with proving the time complexity of their divide-and-conquer algorithm for their CS 381 assignment. They have the problem set but cannot formalize their analysis. About 17 students are working on advanced algorithms around you.', '11111111-aaaa-aaaa-aaaa-111111111111', '77777777-4444-4444-4444-444444444444', 10, 5, '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', ARRAY['d0c10000-aaaa-bbbb-cccc-dddddddddddd']::UUID[], true), -- Document: CS381 Assignment (Techniques for analyzing time and space requirements)
  ('f2522202-aaaa-bbbb-cccc-222222222222', 'NP-Completeness Reductions', 'You are in the Lawson computer lab at 3 PM on a Thursday. A student sits down with their NP-hard problems homework, completely lost on how to construct polynomial-time reductions between problems. They have the assignment document but cannot understand the reduction techniques. About 6 students are working on theory problems nearby.', '33333333-cccc-cccc-cccc-333333333333', '77777777-4444-4444-4444-444444444444', 6, 5, '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', ARRAY['d0c11111-bbbb-cccc-dddd-eeeeeeeeeeee']::UUID[], true), -- Document: CS381 Topic (Brief introduction to intractable NP-hard problems)
  ('f2522203-aaaa-bbbb-cccc-333333333333', 'Graph Algorithm Optimization', 'You are in the HAAS basement at 2 PM on a Tuesday. A student approaches, frustrated with optimizing their graph algorithms for their advanced algorithms project. They understand the basic algorithms but need to improve efficiency for large datasets. About 9 students are working on similar optimization problems.', '11111111-aaaa-aaaa-aaaa-111111111111', '77777777-4444-4444-4444-444444444444', 9, 5, '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', ARRAY['d0c12222-cccc-dddd-eeee-ffffffffffff']::UUID[], true); -- Document: CS381 Topic (Application of techniques to graph problems)

-- Networking Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2522204-aaaa-bbbb-cccc-444444444444', 'Network Protocol Implementation', 'You are in the DSAI computer lab at 5 PM on a Wednesday. A student approaches with their networking project, struggling to implement TCP/IP protocol stack for their computer networks course. They have the specification document but cannot understand the layered architecture. About 12 students are working on systems projects around you.', '33333333-cccc-cccc-cccc-333333333333', '88888888-5555-5555-5555-555555555555', 10, 4, '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', ARRAY['d0c13333-dddd-eeee-ffff-000000000000']::UUID[], true), -- Document: Networking course project specification
  ('f2522205-aaaa-bbbb-cccc-555555555555', 'Socket Programming Challenge', 'You are in the Lawson basement at 1 PM on a Friday. A student approaches, frustrated with their client-server socket programming assignment. They understand the theory but cannot get their code to establish reliable connections. About 8 students are debugging network code nearby.', '11111111-aaaa-aaaa-aaaa-111111111111', '88888888-5555-5555-5555-555555555555', 8, 5, '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', ARRAY['d0c14444-eeee-ffff-0000-111111111111']::UUID[], true), -- Document: Socket programming lab assignment
  ('f2522206-aaaa-bbbb-cccc-666666666666', 'Network Security Protocols', 'You are in the HAAS study area at 3 PM on a Monday. A student sits down with their network security homework, struggling to understand encryption protocols and secure communication channels. They have the assignment but the cryptographic concepts are overwhelming. About 5 students are studying security topics around you.', '33333333-cccc-cccc-cccc-333333333333', '88888888-5555-5555-5555-555555555555', 5, 4, '22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', ARRAY['d0c15555-ffff-0000-1111-222222222222']::UUID[], true); -- Document: Network security homework assignment

-- Machine Learning Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2522207-aaaa-bbbb-cccc-777777777777', 'Neural Network Implementation', 'You are in the DSAI basement lab at 4 PM on a Thursday. A student approaches, frustrated with implementing a neural network from scratch for their machine learning project. They have the mathematical foundations but cannot translate to working code. About 15 students are working on ML projects around you.', '11111111-aaaa-aaaa-aaaa-111111111111', '99999999-6666-6666-6666-666666666666', 10, 5, '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', ARRAY['d0c16666-0000-1111-2222-333333333333']::UUID[], true), -- Document: ML project specification (neural networks)
  ('f2522208-aaaa-bbbb-cccc-888888888888', 'Feature Engineering Problems', 'You are in the Lawson computer lab at 2 PM on a Tuesday. A student approaches with their data preprocessing assignment, struggling to understand feature selection and dimensionality reduction techniques. They have the dataset and requirements but cannot identify relevant features. About 10 students are working on data analysis nearby.', '33333333-cccc-cccc-cccc-333333333333', '99999999-6666-6666-6666-666666666666', 10, 4, '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', ARRAY['d0c17777-1111-2222-3333-444444444444']::UUID[], true), -- Document: ML homework (feature engineering and preprocessing)
  ('f2522209-aaaa-bbbb-cccc-999999999999', 'Model Evaluation Metrics', 'You are in the HAAS basement at 11 AM on a Wednesday. A student sits down with their machine learning evaluation homework, unable to choose appropriate metrics for their classification problem. They understand accuracy but are lost with precision, recall, and F1-scores. About 7 students are working on similar evaluation problems.', '33333333-cccc-cccc-cccc-333333333333', '99999999-6666-6666-6666-666666666666', 7, 4, '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', ARRAY['d0c18888-2222-3333-4444-555555555555']::UUID[], true); -- Document: ML assignment (model evaluation and metrics)

-- ============================================================================
-- FALL 2025 W3 COMMUNICATION TRAINING SCENARIOS
-- ============================================================================

-- Campus Belonging & Identity Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2533c01-aaaa-bbbb-cccc-111111111111', 'Campus Spirit Concern', 'You are in the DSAI study lounge at 3 PM on a Tuesday. A student approaches during office hours and asks, "Why don''t we have the same campus spirit or access to events as West Lafayette?" They seem genuinely curious but also slightly disappointed. About 8 students are studying nearby, and you need to address their concern thoughtfully.', NULL, NULL, 8, 3, '33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', ARRAY[]::UUID[], true),
  ('f2533c02-aaaa-bbbb-cccc-222222222222', 'Transfer Consideration', 'You are in the Lawson basement study area at 4 PM on a Thursday. A student sits down and confides, "I''m considering transferring to the West Lafayette campus, believing it''s the ''real Purdue.''" They seem conflicted and are looking for guidance about their academic future. About 6 students are working quietly around you.', NULL, NULL, 6, 4, '11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', ARRAY[]::UUID[], true),
  ('f2533c03-aaaa-bbbb-cccc-333333333333', 'Microaggression Response', 'You are in the HAAS computer lab at 2 PM on a Wednesday. A student privately approaches and shares, "I''ve heard comments implying Indy students are ''second-tier'' and wonder if others think I don''t belong." They seem hurt and uncertain about their place. The lab is quiet with about 4 students working, creating an intimate setting for this sensitive conversation.', NULL, NULL, 4, 5, '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', ARRAY[]::UUID[], true);

-- Academic Preparedness & Equity Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2533c04-aaaa-bbbb-cccc-444444444444', 'Academic Comparison Struggle', 'You are in the DSAI basement lab at 5 PM on a Monday. A student struggling in CS approaches you privately and shares, "I feel behind compared to West Lafayette students and question if I belong in the program." They seem discouraged and are questioning their abilities. About 12 students are working intensely around you on various CS assignments.', NULL, '44444444-1111-1111-1111-111111111111', 10, 4, '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', ARRAY[]::UUID[], true),
  ('f2533c05-aaaa-bbbb-cccc-555555555555', 'Limited Preparation Concern', 'You are in the Lawson study area at 1 PM on a Tuesday. During office hours, a student says, "I didn''t take AP Computer Science or advanced math in high school like others. I''m already lost, and it''s only Week 2." They seem overwhelmed and worried about keeping up. About 9 students are studying around you, some working on the same introductory material.', NULL, '44444444-1111-1111-1111-111111111111', 9, 4, '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', ARRAY[]::UUID[], true),
  ('f2533c06-aaaa-bbbb-cccc-666666666666', 'Working Student Request', 'You are in the HAAS basement at 3 PM on a Friday. A student emails you and then approaches in person: "I work 30+ hours a week and missed the last two labs. Can I have extra time or get a walkthrough of the material?" They seem tired but determined to succeed despite their challenging schedule. About 7 students are working on lab assignments nearby.', NULL, '44444444-1111-1111-1111-111111111111', 7, 3, '22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', ARRAY[]::UUID[], true);

-- Resource Awareness & Cultural Sensitivity Scenarios
INSERT INTO scenarios (id, name, description, agent_id, class_id, crowdedness, intensity, location_id, time_id, document_ids, default_scenario) VALUES
  ('f2533c07-aaaa-bbbb-cccc-777777777777', 'Resource Disparity Question', 'You are in the DSAI computer lab at 11 AM on a Wednesday. A student approaches, confused, asking about "why tutoring options or lab equipment seem different than what''s available in West Lafayette." They seem frustrated by perceived inequities and want to understand the differences. About 10 students are using the lab equipment around you.', NULL, NULL, 10, 3, '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', ARRAY[]::UUID[], true),
  ('f2533c08-aaaa-bbbb-cccc-888888888888', 'International Student Isolation', 'You are in the Lawson study lounge at 2 PM on a Thursday. An international student expresses that "they feel isolated at Indy and are unsure how to connect with others." They seem lonely and are looking for ways to build community. The lounge is quiet with about 5 students studying, creating a good environment for a supportive conversation.', NULL, NULL, 5, 4, '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', ARRAY[]::UUID[], true),
  ('f2533c09-aaaa-bbbb-cccc-999999999999', 'Disability Accommodation Concern', 'You are in the HAAS study area at 4 PM on a Monday. A student discloses privately that "they''re unsure how to ask for help with a processing disorder, especially since others seem to keep up fine." They seem anxious about seeking accommodations and worried about stigma. About 6 students are studying nearby, and you need to handle this sensitively.', NULL, NULL, 6, 4, '22222222-2222-2222-2222-222222222222', '88888888-8888-8888-8888-888888888888', ARRAY[]::UUID[], true)

ON CONFLICT (id) DO NOTHING;

