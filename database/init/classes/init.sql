-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE class_term AS ENUM ('fall', 'spring', 'summer');
CREATE TYPE document_type AS ENUM ('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');

  CREATE TABLE classes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,  
    class_code TEXT        NOT NULL,
    year       INTEGER     NOT NULL,
    term       class_term  NOT NULL           DEFAULT 'fall',
    description TEXT        NOT NULL
  );


    CREATE TABLE topics (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    prerequisite  BOOLEAN     NOT NULL           DEFAULT FALSE,
    class_id   UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE
  );

    CREATE TABLE schedules (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    class_id UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE
  );


  CREATE TABLE events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL,
    document_type document_type NULL,
    time    TIMESTAMPTZ NOT NULL,
    schedule_id UUID        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE
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
  

  -- Insert Test Class (CS 180 - Essential for quiz testing)
  INSERT INTO classes (id, name, class_code, year, term, description) VALUES
    ('44444444-1111-1111-1111-111111111111', 'Problem Solving And Object-Oriented Programming', 'CS 180', 2024, 'fall', 'Problem solving and algorithms, implementation of algorithms in a high level programming language, conditionals, the iterative approach and debugging, collections of data, searching and sorting, solving problems by decomposition, the object-oriented approach, subclasses of existing classes, handling exceptions that occur when the program is running, graphical user interfaces (GUIs), data stored in files, abstract data types, a glimpse at topics from other CS courses.'),
    ('55555555-2222-2222-2222-222222222222', 'Foundations Of Computer Science', 'CS 182', 2024, 'fall', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.'),
    ('66666666-3333-3333-3333-333333333333', 'Data Structures And Algorithms', 'CS 251', 2024, 'fall', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.'),
    ('77777777-4444-4444-4444-444444444444', 'Introduction To The Analysis Of Algorithms', 'CS 381', 2024, 'fall', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.');

  -- Insert Test Schedule
  INSERT INTO schedules (id, name, description, class_id) VALUES
    ('aaaaaaaa-1111-1111-1111-111111111111', 'CS 180 Fall 2024 Schedule', 'Weekly schedule for Problem Solving and Object-Oriented Programming', '44444444-1111-1111-1111-111111111111'),
    ('bbbbbbbb-1111-1111-1111-111111111111', 'CS 182 Fall 2024 Schedule', 'Weekly schedule for Foundations of Computer Science', '55555555-2222-2222-2222-222222222222'),
    ('cccccccc-1111-1111-1111-111111111111', 'CS 251 Fall 2024 Schedule', 'Weekly schedule for Data Structures and Algorithms', '66666666-3333-3333-3333-333333333333'),
    ('dddddddd-1111-1111-1111-111111111111', 'CS 381 Fall 2024 Schedule', 'Weekly schedule for Introduction to the Analysis of Algorithms', '77777777-4444-4444-4444-444444444444');


  -- Insert Essential Topics for CS 180
  INSERT INTO topics (id, name, description, class_id, prerequisite) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Variables and Data Types', 'Understanding primitive data types, variable declaration, and initialization in Java', '44444444-1111-1111-1111-111111111111', false),
    ('11111111-1111-1111-1111-111111111112', 'Control Structures', 'Conditional statements (if/else), loops (for, while, do-while), and switch statements', '44444444-1111-1111-1111-111111111111', false),
    ('11111111-1111-1111-1111-111111111113', 'Object-Oriented Programming', 'Classes, objects, inheritance, polymorphism, and encapsulation principles', '44444444-1111-1111-1111-111111111111', false);

  -- Insert Test Events
  INSERT INTO events (id, name, description, document_type, time, schedule_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111111', 'Homework 1: Variables and Control', 'Basic programming exercises covering variables, data types, and control structures', 'homework', '2024-09-15 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111112', 'Project 1: Simple Calculator', 'Create a basic calculator application using object-oriented principles', 'project', '2024-10-01 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111');
