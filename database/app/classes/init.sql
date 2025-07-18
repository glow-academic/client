-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE class_term AS ENUM ('fall', 'spring', 'summer');
CREATE TYPE document_type AS ENUM ('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');


  CREATE TABLE departments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    department_code TEXT        NOT NULL,
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    profile_ids UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[]
  );

  CREATE TABLE classes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,  
    class_code TEXT        NOT NULL,
    year       INTEGER     NOT NULL,
    term       class_term  NOT NULL           DEFAULT 'fall',
    description TEXT        NOT NULL,
    default_class      BOOLEAN     NOT NULL DEFAULT FALSE,
    profile_ids UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[]
  );

  CREATE TABLE locations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
  );

  CREATE TABLE documents (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    file_path  TEXT        NOT NULL,
    mime_type  TEXT        NOT NULL,
    class_id   UUID        NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    type       document_type   NOT NULL           DEFAULT 'homework',
    classified BOOLEAN     NOT NULL           DEFAULT FALSE,
    file_id    TEXT        NULL
  );

  INSERT INTO departments (id, name, description, department_code, profile_ids) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Computer Science', 'Computer Science Department', 'CS', ARRAY['a1bc0cb2-c9a2-4c80-8dd5-75156eb58ce1', 'b44a9d96-2b2e-4bcc-88e7-58cb6214aac1', 'c7c6f71a-2a4b-4e87-9320-4f444a603519', '34a3c43e-27ee-4924-9f61-be4ac9e370f2', 'fed71b5d-6170-4462-b919-e992f7716338', '37ed3d71-c381-4933-a1eb-66e3d4e0b0ac']::UUID[]);
  

  -- Insert Test Class (CS 180 - Essential for quiz testing)
  INSERT INTO classes (id, name, class_code, year, term, description, default_class, department_id, profile_ids) VALUES
    ('44444444-1111-1111-1111-111111111111', 'Problem Solving And Object-Oriented Programming', '180', 2024, 'fall', 'Problem solving and algorithms, implementation of algorithms in a high level programming language, conditionals, the iterative approach and debugging, collections of data, searching and sorting, solving problems by decomposition, the object-oriented approach, subclasses of existing classes, handling exceptions that occur when the program is running, graphical user interfaces (GUIs), data stored in files, abstract data types, a glimpse at topics from other CS courses.', true, '11111111-1111-1111-1111-111111111111', ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-bbbb-cccc-111111111111', '33333333-aaaa-bbbb-cccc-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'abcdef12-3456-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'c5180001-1111-2222-3333-444444444444', 'c5180002-1111-2222-3333-444444444444', 'c5abc001-aaaa-bbbb-cccc-dddddddddddd', 'c5abc004-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916601', '99b90118-7b9e-4e12-8e81-d7ccc2916602', '99b90118-7b9e-4e12-8e81-d7ccc2916609', '1a001111-1111-1111-1111-111111111111', '1a001111-2222-2222-2222-222222222222', '1a002222-1111-1111-1111-111111111111', '1a002222-5555-5555-5555-555555555555', '1a003333-5555-5555-5555-555555555555']::UUID[]),
    ('55555555-2222-2222-2222-222222222222', 'Foundations Of Computer Science', '182', 2024, 'fall', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.', true, '11111111-1111-1111-1111-111111111111', ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-aaaa-bbbb-cccc-222222222222', '33333333-aaaa-bbbb-cccc-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '12345678-abcd-efab-cdef-123456789abc', 'abcd1234-efab-cdef-abcd-123456abcdef', 'c5182001-2222-3333-4444-555555555555', 'c5182002-2222-3333-4444-555555555555', 'c5182003-2222-3333-4444-555555555555', 'c5abc001-aaaa-bbbb-cccc-dddddddddddd', 'c5abc002-aaaa-bbbb-cccc-dddddddddddd', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916603', '99b90118-7b9e-4e12-8e81-d7ccc2916604', '99b90118-7b9e-4e12-8e81-d7ccc2916609', '1a001111-3333-3333-3333-333333333333', '1a001111-4444-4444-4444-444444444444', '1a002222-2222-2222-2222-222222222222', '1a002222-5555-5555-5555-555555555555', '1a003333-3333-3333-3333-333333333333', '1a003333-5555-5555-5555-555555555555']::UUID[]),
    ('66666666-3333-3333-3333-333333333333', 'Data Structures And Algorithms', '251', 2024, 'fall', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.', true, '11111111-1111-1111-1111-111111111111', ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-bbbb-cccc-111111111111', '44444444-aaaa-bbbb-cccc-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '87654321-dcba-fedc-baef-987654321cba', 'c5251001-3333-4444-5555-666666666666', 'c5251002-3333-4444-5555-666666666666', 'c5251003-3333-4444-5555-666666666666', 'c5251004-3333-4444-5555-666666666666', 'c5abc002-aaaa-bbbb-cccc-dddddddddddd', 'c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'c5abc004-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916605', '99b90118-7b9e-4e12-8e81-d7ccc2916606', '99b90118-7b9e-4e12-8e81-d7ccc2916610', '1a001111-5555-5555-5555-555555555555', '1a002222-3333-3333-3333-333333333333', '1a003333-1111-1111-1111-111111111111', '1a003333-3333-3333-3333-333333333333', '1a003333-4444-4444-4444-444444444444', '1a003333-5555-5555-5555-555555555555']::UUID[]),
    ('77777777-4444-4444-4444-444444444444', 'Introduction To The Analysis Of Algorithms', '381', 2024, 'fall', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.', true, '11111111-1111-1111-1111-111111111111', ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-aaaa-bbbb-cccc-222222222222', '55555555-aaaa-bbbb-cccc-555555555555', '12ab34cd-56ef-78ab-90cd-12ef34567890', 'c5381001-4444-5555-6666-777777777777', 'c5381002-4444-5555-6666-777777777777', 'c5381003-4444-5555-6666-777777777777', 'c5381004-4444-5555-6666-777777777777', 'c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'c5abc004-aaaa-bbbb-cccc-dddddddddddd', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916607', '99b90118-7b9e-4e12-8e81-d7ccc2916608', '99b90118-7b9e-4e12-8e81-d7ccc2916610', '1a002222-4444-4444-4444-444444444444', '1a003333-2222-2222-2222-222222222222', '1a003333-3333-3333-3333-333333333333', '1a003333-4444-4444-4444-444444444444', '1a003333-5555-5555-5555-555555555555']::UUID[]),
    ('88888888-5555-5555-5555-555555555555', 'Computer Networks', '422', 2024, 'fall', 'Network protocols, socket programming, network security, distributed systems, and network performance analysis. Covers TCP/IP, HTTP, DNS, and other networking fundamentals.', true, '11111111-1111-1111-1111-111111111111', ARRAY[]::UUID[]),
    ('99999999-6666-6666-6666-666666666666', 'Machine Learning', '373', 2024, 'fall', 'Introduction to machine learning algorithms, neural networks, feature engineering, model evaluation, and practical applications. Covers supervised and unsupervised learning techniques.', true, '11111111-1111-1111-1111-111111111111', ARRAY[]::UUID[]);


  INSERT INTO locations (id, name, description, department_id) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Lawson', 'An open, collaborative space in the Lawson building with high foot traffic.', '11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222', 'HAAS', 'A quiet, focused study environment in the lower level of the HAAS building.', '11111111-1111-1111-1111-111111111111'),
    ('33333333-3333-3333-3333-333333333333', 'DSAI', 'A specialized tech-focused lab environment in the basement of the Data Science/AI building.', '11111111-1111-1111-1111-111111111111');

-- ============================================================================
-- DOCUMENT ENTRIES FOR TRAINING SCENARIOS
-- ============================================================================

-- Insert Documents for Training Scenarios
INSERT INTO documents (id, name, file_path, mime_type, class_id, type, classified, file_id) VALUES
  ('d0c11111-2222-3333-4444-444444444444', 'CS180 Project - Methods and Classes', 'd0c11111-2222-3333-4444-444444444444.txt', 'text/plain', '44444444-1111-1111-1111-111111111111', 'project', false, 'doc-1'), -- Document: CS180 Project assignment (Methods and Classes)
  ('d0c22222-3333-4444-5555-555555555555', 'CS180 Homework - Interfaces and Inheritance', 'd0c22222-3333-4444-5555-555555555555.txt', 'text/plain', '44444444-1111-1111-1111-111111111111', 'homework', false, 'doc-2'), -- Document: CS180 Homework (Interfaces and Inheritance)
  ('d0c33333-4444-5555-6666-666666666666', 'CS180 Lab - Polymorphism and Dynamic Data Structures', 'd0c33333-4444-5555-6666-666666666666.txt', 'text/plain', '44444444-1111-1111-1111-111111111111', 'lab', false, 'doc-3'), -- Document: CS180 Lab (Polymorphism, Dynamic Data Structures)
  ('d0c44444-5555-6666-7777-777777777777', 'CS182 Homework - Proof Techniques including Mathematical Induction', 'd0c44444-5555-6666-7777-777777777777.txt', 'text/plain', '55555555-2222-2222-2222-222222222222', 'homework', false, 'doc-4'), -- Document: CS182 Homework (Proof Techniques including Mathematical Induction)
  ('d0c55555-6666-7777-8888-888888888888', 'CS182 Lecture - Basic Logic', 'd0c55555-6666-7777-8888-888888888888.txt', 'text/plain', '55555555-2222-2222-2222-222222222222', 'lecture', false, 'doc-5'), -- Document: CS182 Lecture (Basic Logic)
  ('d0c66666-7777-8888-9999-999999999999', 'CS182 Lecture - The Language of Mathematics', 'd0c66666-7777-8888-9999-999999999999.txt', 'text/plain', '55555555-2222-2222-2222-222222222222', 'lecture', false, 'doc-6'), -- Document: CS182 Lecture (The Language of Mathematics)
  ('d0c77777-8888-9999-aaaa-aaaaaaaaaaaa', 'CS251 Midterm Topics - Runtime Expressions and Asymptotic Runtime Analysis', 'd0c77777-8888-9999-aaaa-aaaaaaaaaaaa.txt', 'text/plain', '66666666-3333-3333-3333-333333333333', 'midterm', false, 'doc-7'), -- Document: CS251 Midterm topics (Runtime Expressions, Asymptotic Runtime Analysis)
  ('d0c88888-9999-aaaa-bbbb-bbbbbbbbbbbb', 'CS251 Midterm Topics - Arrays and Linked Lists', 'd0c88888-9999-aaaa-bbbb-bbbbbbbbbbbb.txt', 'text/plain', '66666666-3333-3333-3333-333333333333', 'midterm', false, 'doc-8'), -- Document: CS251 Midterm topics (Arrays and Linked Lists)
  ('d0c99999-aaaa-bbbb-cccc-cccccccccccc', 'CS251 Midterm Topics - Binary Trees', 'd0c99999-aaaa-bbbb-cccc-cccccccccccc.txt', 'text/plain', '66666666-3333-3333-3333-333333333333', 'midterm', false, 'doc-9'), -- Document: CS251 Midterm topics (Binary Trees)
  ('d0c10000-aaaa-bbbb-cccc-dddddddddddd', 'CS381 Assignment - Techniques for analyzing time and space requirements', 'd0c10000-aaaa-bbbb-cccc-dddddddddddd.txt', 'text/plain', '77777777-4444-4444-4444-444444444444', 'homework', false, 'doc-10'), -- Document: CS381 Assignment (Techniques for analyzing time and space requirements)
  ('d0c11111-bbbb-cccc-dddd-eeeeeeeeeeee', 'CS381 Topic - Brief introduction to intractable NP-hard problems', 'd0c11111-bbbb-cccc-dddd-eeeeeeeeeeee.txt', 'text/plain', '77777777-4444-4444-4444-444444444444', 'lecture', false, 'doc-11'), -- Document: CS381 Topic (Brief introduction to intractable NP-hard problems)
  ('d0c12222-cccc-dddd-eeee-ffffffffffff', 'CS381 Topic - Application of techniques to graph problems', 'd0c12222-cccc-dddd-eeee-ffffffffffff.txt', 'text/plain', '77777777-4444-4444-4444-444444444444', 'lecture', false, 'doc-12'), -- Document: CS381 Topic (Application of techniques to graph problems)
  ('d0c13333-dddd-eeee-ffff-000000000000', 'Networking Course Project Specification', 'd0c13333-dddd-eeee-ffff-000000000000.txt', 'text/plain', '88888888-5555-5555-5555-555555555555', 'project', false, 'doc-13'), -- Document: Networking course project specification
  ('d0c14444-eeee-ffff-0000-111111111111', 'Socket Programming Lab Assignment', 'd0c14444-eeee-ffff-0000-111111111111.txt', 'text/plain', '88888888-5555-5555-5555-555555555555', 'lab', false, 'doc-14'), -- Document: Socket programming lab assignment
  ('d0c15555-ffff-0000-1111-222222222222', 'Network Security Homework Assignment', 'd0c15555-ffff-0000-1111-222222222222.txt', 'text/plain', '88888888-5555-5555-5555-555555555555', 'homework', false, 'doc-15'), -- Document: Network security homework assignment
  ('d0c16666-0000-1111-2222-333333333333', 'ML Project Specification - Neural Networks', 'd0c16666-0000-1111-2222-333333333333.txt', 'text/plain', '99999999-6666-6666-6666-666666666666', 'project', false, 'doc-16'), -- Document: ML project specification (neural networks)
  ('d0c17777-1111-2222-3333-444444444444', 'ML Homework - Feature Engineering and Preprocessing', 'd0c17777-1111-2222-3333-444444444444.txt', 'text/plain', '99999999-6666-6666-6666-666666666666', 'homework', false, 'doc-17'), -- Document: ML homework (feature engineering and preprocessing)
  ('d0c18888-2222-3333-4444-555555555555', 'ML Assignment - Model Evaluation and Metrics', 'd0c18888-2222-3333-4444-555555555555.txt', 'text/plain', '99999999-6666-6666-6666-666666666666', 'homework', false, 'doc-18'); -- Document: ML assignment (model evaluation and metrics)
