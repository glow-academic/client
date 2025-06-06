-- Enable the gen_random_uuid() function
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- ============================================================================
  -- TABLE DEFINITIONS
  -- ============================================================================

  CREATE TYPE user_role AS ENUM ('admin', 'instructional', 'instructor', 'ta');
  CREATE TYPE document_type AS ENUM ('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');
  CREATE TYPE seniority_levels AS ENUM ('freshman', 'sophomore', 'junior', 'senior');
  CREATE TYPE class_term AS ENUM ('fall', 'spring', 'summer');

  CREATE TABLE profiles (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    subtitle   TEXT        NOT NULL,
    description TEXT        NOT NULL,
    prompt     TEXT        NOT NULL,
    threshold  INTEGER     NOT NULL -- 0-100
  );

  CREATE TABLE scenarios (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL
  );

  CREATE TABLE chat_templates (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    profile_id UUID        NULL REFERENCES profiles(id)  ON DELETE SET NULL, -- can be null for global templates
    scenario_id UUID        NULL REFERENCES scenarios(id)  ON DELETE SET NULL, -- can be null for global templates
    crowdedness INTEGER     NOT NULL,
    intensity INTEGER     NOT NULL,
    seniority seniority_levels NOT NULL             DEFAULT 'freshman'
  );

  CREATE TABLE templates (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    title      TEXT        NOT NULL,
    documents UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[],
    time_limit INTEGER     NULL,          -- in minutes, or no time limit
    active      BOOLEAN     NOT NULL           DEFAULT TRUE,
    chat_template_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[]
  );

  CREATE TABLE schedules (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL
  );

  CREATE TABLE classes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,  
    class_code TEXT        NOT NULL,
    year       INTEGER     NOT NULL,
    term       class_term  NOT NULL           DEFAULT 'fall',
    description TEXT        NOT NULL,
    template_ids UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[],
    syllabus_id UUID        NULL,
    schedule_id UUID        NULL REFERENCES schedules(id) ON DELETE SET NULL
  );

  CREATE TABLE topics (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    class_id   UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE prerequisites (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    class_id   UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE deadlines (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL,
    document_type document_type NOT NULL       DEFAULT 'homework',
    due_time    TIMESTAMPTZ NOT NULL,
    schedule_id UUID        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE
  );

  CREATE TABLE users (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    viewed_intro BOOLEAN     NOT NULL           DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    role       user_role   NOT NULL           DEFAULT 'ta',
    name       TEXT        NOT NULL,
    username   TEXT        NOT NULL UNIQUE,
    password   TEXT        NOT NULL,
    class_ids    UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[]
  );

  CREATE TABLE documents (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    file_path  TEXT        NOT NULL,
    mime_type  TEXT        NOT NULL,
    class_id   UUID        NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    type       document_type   NOT NULL           DEFAULT 'homework',
    classified BOOLEAN     NOT NULL           DEFAULT FALSE
  );

  CREATE TABLE attempts (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    user_id    UUID         NULL REFERENCES users(id)  ON DELETE CASCADE,
    class_id   UUID         NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    template_id    UUID        NOT NULL REFERENCES templates(id)  ON DELETE CASCADE
  );

  CREATE TABLE chats (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
    completed_at TIMESTAMPTZ  NULL,
    title      TEXT         NOT NULL,
    scenario_id UUID         NOT NULL REFERENCES scenarios(id)  ON DELETE CASCADE, -- must converge when creating a chat
    profile_id UUID         NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE, -- must converge when creating a chat
    chat_template_id UUID         NOT NULL REFERENCES chat_templates(id)  ON DELETE CASCADE, -- must converge when creating a chat
    completed  BOOLEAN      NOT NULL           DEFAULT FALSE,
    attempt_id UUID         NOT NULL REFERENCES attempts(id)  ON DELETE CASCADE
  );

  CREATE TABLE messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    chat_id    UUID        NOT NULL REFERENCES chats(id)  ON DELETE CASCADE,
    query      TEXT        NOT NULL,
    response   TEXT        NOT NULL,
    completed  BOOLEAN     NOT NULL           DEFAULT FALSE
  );

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

  -- ============================================================================
  -- ESSENTIAL TEST DATA
  -- ============================================================================

  -- Insert Core Profiles (Essential for testing)
  INSERT INTO profiles (id, name, subtitle, description, threshold, prompt) VALUES
    ('11111111-aaaa-aaaa-aaaa-111111111111', 'Aggressive', 'Direct and Challenging', 'Pushes back on your ideas and challenges assumptions.', 50, 'Try and truly embrace your anger and aggressiveness in various ways, such as making certain words, not sentences, in all caps, or adding multiple "!", or just anything you think would truly portray an incredibly aggressive student.'),
    ('22222222-bbbb-bbbb-bbbb-222222222222', 'Happy', 'Positive and Encouraging', 'Provides uplifting feedback and cheerful responses.', 50, 'Remember the you are a student, not an AI, so keep conversations natural, concise, and engaging, dont say unnecessary information just for the sake of having more words.'),
    ('33333333-cccc-cccc-cccc-333333333333', 'Confused', 'Asks clarifying questions', 'Seeks to understand by asking questions and exploring ideas', 50, 'There is a fundamental misunderstanding of a given concept, and you have this lead to your answers being incorrect.');

  -- Insert Essential Scenarios
  INSERT INTO scenarios (id, name, description) VALUES
    ('11111111-aaaa-aaaa-aaaa-111111111111', 'NullPointer Exception', 'A student storms in holding their Java console output, annoyed by a runtime error they can''t trace in their GUI project.'),
    ('22222222-bbbb-bbbb-bbbb-222222222222', 'File I/O Issues', 'A student timidly approaches, worried they''ve overwritten their data file while implementing file read/write methods.'),
    ('33333333-cccc-cccc-cccc-333333333333', 'Subclass Constructors', 'A student beams in excitedly, eager to understand how to call superclass constructors in their subclass design.'),
    ('44444444-dddd-dddd-dddd-444444444444', 'Proof by Induction', 'A student sits confidently with their proof draft, asking for confirmation on their inductive step for summations.'),
    ('55555555-eeee-eeee-eeee-555555555555', 'Pigeonhole Principle', 'A student paces back and forth, perplexed about applying the pigeonhole principle to their combinatorics problem.'),
    ('66666666-ffff-ffff-ffff-666666666666', 'Finite Automata Diagram', 'An enthusiastic student draws state diagrams on the whiteboard, seeking advice on minimizing states in their DFA.'),
    ('77777777-aaaa-bbbb-cccc-777777777777', 'Hash Table Collision', 'A student looks frustrated at their printed hash table output, unsure why multiple keys map to the same bucket.'),
    ('88888888-bbbb-cccc-dddd-888888888888', 'Dijkstra Implementation', 'A student proudly shows their weighted graph code, asking if their priority queue usage is optimal.'),
    ('99999999-cccc-dddd-eeee-999999999999', 'Recursive Tree Traversal', 'A student frowns while tracing recursion on paper, confused by the difference between pre- and post-order.'),
    ('aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', 'Recurrence Relations', 'A student is eager to verify their Master Theorem application to the recurrence for merge sort.'),
    ('bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', 'NP-Completeness', 'A student sits back with their arms crossed, skeptical about why SAT reduces to 3-SAT.'),
    ('cccccccc-ffff-aaaa-bbbb-cccccccccccc', 'Dynamic Programming', 'A student smiles warmly, proud of their bottom-up DP table for the knapsack problem, seeking edge-case checks.');

  -- Insert Test Schedule
  INSERT INTO schedules (id, name, description) VALUES
    ('aaaaaaaa-1111-1111-1111-111111111111', 'CS 180 Fall 2024 Schedule', 'Weekly schedule for Problem Solving and Object-Oriented Programming');

  -- Insert Test Class (CS 180 - Essential for quiz testing)
  INSERT INTO classes (id, name, class_code, year, term, description, template_ids, schedule_id) VALUES
    ('44444444-1111-1111-1111-111111111111', 'Problem Solving And Object-Oriented Programming', 'CS 180', 2024, 'fall', 'Problem solving and algorithms, implementation of algorithms in a high level programming language, conditionals, the iterative approach and debugging, collections of data, searching and sorting, solving problems by decomposition, the object-oriented approach, subclasses of existing classes, handling exceptions that occur when the program is running, graphical user interfaces (GUIs), data stored in files, abstract data types, a glimpse at topics from other CS courses.', ARRAY['aaaaaaaa-bbbb-cccc-dddd-111111111111']::UUID[], 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('55555555-2222-2222-2222-222222222222', 'Foundations Of Computer Science', 'CS 182', 2024, 'fall', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.', ARRAY['aaaaaaaa-bbbb-cccc-dddd-111111111111']::UUID[], 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('66666666-3333-3333-3333-333333333333', 'Data Structures And Algorithms', 'CS 251', 2024, 'fall', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.', ARRAY['aaaaaaaa-bbbb-cccc-dddd-111111111111']::UUID[], 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('77777777-4444-4444-4444-444444444444', 'Introduction To The Analysis Of Algorithms', 'CS 381', 2024, 'fall', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.', ARRAY['aaaaaaaa-bbbb-cccc-dddd-111111111111']::UUID[], 'aaaaaaaa-1111-1111-1111-111111111111');

  -- Insert Essential Topics for CS 180
  INSERT INTO topics (id, name, description, class_id) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Variables and Data Types', 'Understanding primitive data types, variable declaration, and initialization in Java', '44444444-1111-1111-1111-111111111111'),
    ('11111111-1111-1111-1111-111111111112', 'Control Structures', 'Conditional statements (if/else), loops (for, while, do-while), and switch statements', '44444444-1111-1111-1111-111111111111'),
    ('11111111-1111-1111-1111-111111111113', 'Object-Oriented Programming', 'Classes, objects, inheritance, polymorphism, and encapsulation principles', '44444444-1111-1111-1111-111111111111');

  -- Insert Basic Prerequisites
  INSERT INTO prerequisites (id, name, description, class_id) VALUES
    ('11111111-aaaa-aaaa-aaaa-111111111111', 'High School Mathematics', 'Algebra and basic mathematical reasoning skills', '44444444-1111-1111-1111-111111111111'),
    ('11111111-aaaa-aaaa-aaaa-111111111112', 'Basic Computer Literacy', 'Familiarity with using computers and basic software applications', '44444444-1111-1111-1111-111111111111');

  -- Insert Test Deadlines
  INSERT INTO deadlines (id, name, description, document_type, due_time, schedule_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111111', 'Homework 1: Variables and Control', 'Basic programming exercises covering variables, data types, and control structures', 'homework', '2024-09-15 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111112', 'Project 1: Simple Calculator', 'Create a basic calculator application using object-oriented principles', 'project', '2024-10-01 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111');

  -- Insert Test Admin User
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, 'admin', 'Test Admin', 'test_admin', 'hashed_password_admin', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, 'ta', 'Nina Park', 'nina_park', 'hashed_password_2', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', false, 'ta', 'Pranav Patel', 'pranav_patel', 'hashed_password_3', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', true, 'ta', 'Richie Qian', 'richie_qian', 'hashed_password_4', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, 'ta', 'Rohan Saxena', 'rohan_saxena', 'hashed_password_5', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', true, 'ta', 'Saket Shi', 'saket_shi', 'hashed_password_6', ARRAY['44444444-1111-1111-1111-111111111111', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('12345678-abcd-efab-cdef-123456789abc', false, 'ta', 'Tony Xu', 'tony_xu', 'hashed_password_7', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
    ('87654321-dcba-fedc-baef-987654321cba', true, 'ta', 'Tayden Xiao', 'tayden_xiao', 'hashed_password_8', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('abcdef12-3456-7890-abcd-ef1234567890', false, 'ta', 'Samarth Soe', 'samarth_soe', 'hashed_password_9', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
    ('12ab34cd-56ef-78ab-90cd-12ef34567890', true, 'ta', 'William Yoon', 'william_yoon', 'hashed_password_10', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
    ('abcd1234-efab-cdef-abcd-123456abcdef', false, 'ta', 'Yuting Zhou', 'yuting_zhou', 'hashed_password_11', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', true, 'ta', 'Nikita Park', 'nikita_park', 'hashed_password_12', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]);

  -- Insert Chat Templates (Essential for testing)
  INSERT INTO chat_templates (id, profile_id, crowdedness, intensity, seniority) VALUES
    ('11111111-1111-1111-1111-111111111111', '11111111-aaaa-aaaa-aaaa-111111111111', 3, 4, 'sophomore'),
    ('33333333-3333-3333-3333-333333333333', '22222222-bbbb-bbbb-bbbb-222222222222', 2, 2, 'freshman'),
    ('55555555-5555-5555-5555-555555555555', '33333333-cccc-cccc-cccc-333333333333', 1, 5, 'freshman')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Templates (Essential for testing)
  INSERT INTO templates (id, title, documents, time_limit, active, chat_template_ids) VALUES
    ('aaaaaaaa-bbbb-cccc-dddd-111111111111', 'Coding Practice Template', ARRAY[]::UUID[], 15, true, ARRAY['11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555']::UUID[])
  ON CONFLICT (id) DO NOTHING;

  -- Insert Attempts (Essential for linking chats to templates and users)
  INSERT INTO attempts (id, created_at, user_id, class_id, template_id) VALUES
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
  INSERT INTO chats (id, created_at, completed_at, title, scenario_id, profile_id, chat_template_id, completed, attempt_id) VALUES
    -- CS 180 (Problem Solving And Object-Oriented Programming)
    ('f1e2d3c4-b5a6-47f8-9e00-111111111111', NOW() - INTERVAL '2 hours', NULL, 'NullPointer Exception', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', false, 'f1e2d3c4-b5a6-47f8-9e00-111111111111'),
    ('f1e2d3c4-b5a6-47f8-9e00-222222222222', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'File I/O Issues', '22222222-bbbb-bbbb-bbbb-222222222222', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-3333-3333-3333-333333333333', true, 'f1e2d3c4-b5a6-47f8-9e00-222222222222'),
    ('f1e2d3c4-b5a6-47f8-9e00-333333333333', NOW() - INTERVAL '3 hours', NULL, 'Subclass Constructors', '33333333-cccc-cccc-cccc-333333333333', '33333333-cccc-cccc-cccc-333333333333', '55555555-5555-5555-5555-555555555555', false, 'f1e2d3c4-b5a6-47f8-9e00-333333333333'),

    -- CS 182 (Foundations Of Computer Science)  
    ('f1e2d3c4-b5a6-47f8-9e00-444444444444', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 'Proof by Induction', '44444444-dddd-dddd-dddd-444444444444', '22222222-bbbb-bbbb-bbbb-222222222222', '11111111-1111-1111-1111-111111111111', true, 'f1e2d3c4-b5a6-47f8-9e00-444444444444'),
    ('f1e2d3c4-b5a6-47f8-9e00-555555555555', NOW() - INTERVAL '6 hours', NULL, 'Pigeonhole Principle', '55555555-eeee-eeee-eeee-555555555555', '33333333-cccc-cccc-cccc-333333333333', '33333333-3333-3333-3333-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-555555555555'),
    ('f1e2d3c4-b5a6-47f8-9e00-666666666666', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', 'Finite Automata Diagram', '66666666-ffff-ffff-ffff-666666666666', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', true, 'f1e2d3c4-b5a6-47f8-9e00-666666666666'),

    -- CS 251 (Data Structures And Algorithms)
    ('f1e2d3c4-b5a6-47f8-9e00-777777777777', NOW() - INTERVAL '4 hours', NULL, 'Hash Table Collision', '77777777-aaaa-bbbb-cccc-777777777777', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', false, 'f1e2d3c4-b5a6-47f8-9e00-777777777777'),
    ('f1e2d3c4-b5a6-47f8-9e00-888888888888', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Dijkstra Implementation', '88888888-bbbb-cccc-dddd-888888888888', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-3333-3333-3333-333333333333', true, 'f1e2d3c4-b5a6-47f8-9e00-888888888888'),
    ('f1e2d3c4-b5a6-47f8-9e00-999999999999', NOW() - INTERVAL '1 hour', NULL, 'Recursive Tree Traversal', '99999999-cccc-dddd-eeee-999999999999', '33333333-cccc-cccc-cccc-333333333333', '55555555-5555-5555-5555-555555555555', false, 'f1e2d3c4-b5a6-47f8-9e00-999999999999'),

    -- CS 381 (Introduction To The Analysis Of Algorithms)
    ('f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', 'Recurrence Relations', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', '22222222-bbbb-bbbb-bbbb-222222222222', '11111111-1111-1111-1111-111111111111', true, 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
    ('f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb', NOW() - INTERVAL '5 hours', NULL, 'NP-Completeness', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', '11111111-aaaa-aaaa-aaaa-111111111111', '33333333-3333-3333-3333-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb'),
    ('f1e2d3c4-b5a6-47f8-9e00-cccccccccccc', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Dynamic Programming', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', true, 'f1e2d3c4-b5a6-47f8-9e00-cccccccccccc'),

    -- Additional comprehensive chats
    ('aaaaaaaa-1111-2222-3333-444444444441', NOW() - INTERVAL '30 minutes', NULL, 'Infinite Loop', '11111111-aaaa-aaaa-aaaa-111111111111', '33333333-cccc-cccc-cccc-333333333333', '11111111-1111-1111-1111-111111111111', false, 'aaaaaaaa-1111-2222-3333-444444444441'),
    ('aaaaaaaa-1111-2222-3333-444444444442', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Master Theorem Edge Case', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-111111111111', '33333333-3333-3333-3333-333333333333', true, 'aaaaaaaa-1111-2222-3333-444444444442'),
    ('aaaaaaaa-1111-2222-3333-444444444443', NOW() - INTERVAL '3 hours', NULL, 'Balancing BST', '99999999-cccc-dddd-eeee-999999999999', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', false, 'aaaaaaaa-1111-2222-3333-444444444443'),
    ('aaaaaaaa-1111-2222-3333-444444444444', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours', 'Adjacency List', '77777777-aaaa-bbbb-cccc-777777777777', '33333333-cccc-cccc-cccc-333333333333', '11111111-1111-1111-1111-111111111111', true, 'aaaaaaaa-1111-2222-3333-444444444444'),
    ('aaaaaaaa-1111-2222-3333-444444444445', NOW() - INTERVAL '1 day', NULL, 'Set Theory Paradox', '44444444-dddd-dddd-dddd-444444444444', '11111111-aaaa-aaaa-aaaa-111111111111', '33333333-3333-3333-3333-333333333333', false, 'aaaaaaaa-1111-2222-3333-444444444445'),
    ('aaaaaaaa-1111-2222-3333-444444444446', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours', 'Branch and Bound', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', true, 'aaaaaaaa-1111-2222-3333-444444444446'),
    ('aaaaaaaa-1111-2222-3333-444444444447', NOW() - INTERVAL '4 days', NULL, 'Proof by Contradiction', '44444444-dddd-dddd-dddd-444444444444', '33333333-cccc-cccc-cccc-333333333333', '11111111-1111-1111-1111-111111111111', false, 'aaaaaaaa-1111-2222-3333-444444444447'),
    ('aaaaaaaa-1111-2222-3333-444444444448', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours', 'Interface Design', '33333333-cccc-cccc-cccc-333333333333', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-3333-3333-3333-333333333333', true, 'aaaaaaaa-1111-2222-3333-444444444448'),
    ('aaaaaaaa-1111-2222-3333-444444444449', NOW() - INTERVAL '7 days', NULL, 'Polynomial Reduction', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', '11111111-aaaa-aaaa-aaaa-111111111111', '55555555-5555-5555-5555-555555555555', false, 'aaaaaaaa-1111-2222-3333-444444444449'),
    ('aaaaaaaa-1111-2222-3333-444444444450', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Recursion vs Iteration', '55555555-eeee-eeee-eeee-555555555555', '33333333-cccc-cccc-cccc-333333333333', '11111111-1111-1111-1111-111111111111', true, 'aaaaaaaa-1111-2222-3333-444444444450'),
    ('55555555-aaaa-bbbb-cccc-111111111111', NOW() - INTERVAL '1 day', NULL, 'Garbage Collection', '11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-3333-3333-3333-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-111111111111'),
    ('55555555-aaaa-bbbb-cccc-222222222222', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Amortized Analysis', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-111111111111', '55555555-5555-5555-5555-555555555555', true, 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
    ('55555555-aaaa-bbbb-cccc-333333333333', NOW() - INTERVAL '3 days', NULL, 'Graph Traversal', '88888888-bbbb-cccc-dddd-888888888888', '33333333-cccc-cccc-cccc-333333333333', '11111111-1111-1111-1111-111111111111', false, 'f1e2d3c4-b5a6-47f8-9e00-888888888888'),
    ('55555555-aaaa-bbbb-cccc-444444444444', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', 'Stack Overflow', '99999999-cccc-dddd-eeee-999999999999', '11111111-aaaa-aaaa-aaaa-111111111111', '33333333-3333-3333-3333-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-999999999999'),
    ('55555555-aaaa-bbbb-cccc-555555555555', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Lambda Expressions', '66666666-ffff-ffff-ffff-666666666666', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', true, 'f1e2d3c4-b5a6-47f8-9e00-555555555555'),
    ('55555555-aaaa-bbbb-cccc-666666666666', NOW() - INTERVAL '3 days', NULL, 'Deadlock Detection', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', '33333333-cccc-cccc-cccc-333333333333', '11111111-1111-1111-1111-111111111111', false, 'f1e2d3c4-b5a6-47f8-9e00-666666666666'),
    ('55555555-aaaa-bbbb-cccc-777777777777', NOW() - INTERVAL '6 hours', NULL, 'State Minimization', '66666666-ffff-ffff-ffff-666666666666', '11111111-aaaa-aaaa-aaaa-111111111111', '33333333-3333-3333-3333-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-666666666666'),
    ('55555555-aaaa-bbbb-cccc-888888888888', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', 'Interface Segregation', '33333333-cccc-cccc-cccc-333333333333', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', true, 'f1e2d3c4-b5a6-47f8-9e00-777777777777'),
    ('55555555-aaaa-bbbb-cccc-999999999999', NOW() - INTERVAL '2 days', NULL, 'Exception Chaining', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333', '11111111-1111-1111-1111-111111111111', false, 'f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb'),
    ('55555555-aaaa-bbbb-cccc-000000000000', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 'Heuristic Search', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-111111111111', '33333333-3333-3333-3333-333333333333', true, 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
    ('66666666-aaaa-bbbb-cccc-111111111111', NOW() - INTERVAL '1 day', NULL, 'Array Index Out of Bounds', '11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', false, 'f1e2d3c4-b5a6-47f8-9e00-111111111111'),
    ('66666666-aaaa-bbbb-cccc-222222222222', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', 'Generics Syntax', '33333333-cccc-cccc-cccc-333333333333', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', true, 'f1e2d3c4-b5a6-47f8-9e00-777777777777'),
    ('66666666-aaaa-bbbb-cccc-333333333333', NOW() - INTERVAL '2 days', NULL, 'Graph Isomorphism', '88888888-bbbb-cccc-dddd-888888888888', '33333333-cccc-cccc-cccc-333333333333', '33333333-3333-3333-3333-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-888888888888'),
    ('66666666-aaaa-bbbb-cccc-444444444444', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Regular Expressions', '66666666-ffff-ffff-ffff-666666666666', '22222222-bbbb-bbbb-bbbb-222222222222', '55555555-5555-5555-5555-555555555555', true, 'f1e2d3c4-b5a6-47f8-9e00-444444444444'),
    ('66666666-aaaa-bbbb-cccc-555555555555', NOW() - INTERVAL '5 hours', NULL, 'Priority Queue Interface', '77777777-aaaa-bbbb-cccc-777777777777', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', false, 'f1e2d3c4-b5a6-47f8-9e00-777777777777'),
    ('66666666-aaaa-bbbb-cccc-666666666666', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', 'Topological Sort', '88888888-bbbb-cccc-dddd-888888888888', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-3333-3333-3333-333333333333', true, 'f1e2d3c4-b5a6-47f8-9e00-888888888888'),
    ('66666666-aaaa-bbbb-cccc-777777777777', NOW() - INTERVAL '3 days', NULL, 'Space Complexity', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', '33333333-cccc-cccc-cccc-333333333333', '55555555-5555-5555-5555-555555555555', false, 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
    ('66666666-aaaa-bbbb-cccc-888888888888', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Approximation Algorithms', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', true, 'f1e2d3c4-b5a6-47f8-9e00-bbbbbbbbbbbb'),
    ('66666666-aaaa-bbbb-cccc-999999999999', NOW() - INTERVAL '5 days', NULL, 'Randomized Algorithms', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-3333-3333-3333-333333333333', false, 'f1e2d3c4-b5a6-47f8-9e00-aaaaaaaaaaaa'),
    ('66666666-aaaa-bbbb-cccc-000000000000', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', 'Recursive Definitions', '55555555-eeee-eeee-eeee-555555555555', '33333333-cccc-cccc-cccc-333333333333', '55555555-5555-5555-5555-555555555555', true, 'f1e2d3c4-b5a6-47f8-9e00-999999999999');

  -- Insert Comprehensive Rubrics (for completed chats only)
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
    
    -- Stack Overflow (marked as completed but score indicates failure)
    ('55555555-aaaa-bbbb-cccc-444444444444', false, 8, 300, 2, 'Failed to adapt to student''s panic, became too technical too quickly', 3, 'Missed the emotional distress signals from the student', 2, 'Did not address the core debugging methodology', 3, 'Rushed through without ensuring understanding'),
    
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

  -- Insert Permanent Chat Templates for Individual Practice
  INSERT INTO chat_templates (id, profile_id, scenario_id, crowdedness, intensity, seniority) VALUES
    ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-aaaa-aaaa-aaaa-111111111111', NULL, 3, 4, 'sophomore'),
    ('bbbbbbbb-2222-2222-2222-222222222222', '22222222-bbbb-bbbb-bbbb-222222222222', NULL, 2, 2, 'freshman'),
    ('cccccccc-3333-3333-3333-333333333333', '33333333-cccc-cccc-cccc-333333333333', NULL, 1, 5, 'freshman')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Permanent Templates for Individual Practice (using existing chat templates)
  INSERT INTO templates (id, title, documents, time_limit, active, chat_template_ids) VALUES
    ('aaaaaaaa-1111-2222-3333-444444444444', 'Aggressive Student Practice', ARRAY[]::UUID[], NULL, true, ARRAY['11111111-1111-1111-1111-111111111111']::UUID[]),
    ('bbbbbbbb-1111-2222-3333-444444444444', 'Happy Student Practice', ARRAY[]::UUID[], NULL, true, ARRAY['33333333-3333-3333-3333-333333333333']::UUID[]),
    ('cccccccc-1111-2222-3333-444444444444', 'Confused Student Practice', ARRAY[]::UUID[], NULL, true, ARRAY['55555555-5555-5555-5555-555555555555']::UUID[])
  ON CONFLICT (id) DO NOTHING;