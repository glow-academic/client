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
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,  
    class_code TEXT        NOT NULL,
    year       INTEGER     NOT NULL,
    term       class_term  NOT NULL           DEFAULT 'fall',
    description TEXT        NOT NULL
  );


  CREATE TABLE topics (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    prerequisite  BOOLEAN     NOT NULL           DEFAULT FALSE,
    class_id   UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE
  );

    CREATE TABLE schedules (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    class_id UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE
  );


  CREATE TABLE events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL,
    document_type document_type NULL,
    time    TIMESTAMPTZ NOT NULL,
    schedule_id UUID        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE
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

  -- Insert Comprehensive Topics for CS 180
  INSERT INTO topics (id, name, description, class_id, prerequisite) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Variables and Data Types', 'Understanding primitive data types, variable declaration, and initialization in Java', '44444444-1111-1111-1111-111111111111', false),
    ('11111111-1111-1111-1111-111111111112', 'Control Structures', 'Conditional statements (if/else), loops (for, while, do-while), and switch statements', '44444444-1111-1111-1111-111111111111', false),
    ('11111111-1111-1111-1111-111111111113', 'Object-Oriented Programming', 'Classes, objects, inheritance, polymorphism, and encapsulation principles', '44444444-1111-1111-1111-111111111111', false),
    ('11111111-1111-1111-1111-111111111114', 'Arrays and Collections', 'Working with arrays, ArrayLists, and other collection data structures', '44444444-1111-1111-1111-111111111111', false),
    ('11111111-1111-1111-1111-111111111115', 'File I/O Operations', 'Reading from and writing to files, handling file exceptions', '44444444-1111-1111-1111-111111111111', true),
    ('11111111-1111-1111-1111-111111111116', 'GUI Programming', 'Creating graphical user interfaces with Swing components', '44444444-1111-1111-1111-111111111111', true);

  -- Insert Topics for CS 182
  INSERT INTO topics (id, name, description, class_id, prerequisite) VALUES
    ('22222222-2222-2222-2222-222222222221', 'Logic and Proofs', 'Propositional logic, predicate logic, and proof techniques', '55555555-2222-2222-2222-222222222222', false),
    ('22222222-2222-2222-2222-222222222222', 'Sets and Functions', 'Set theory, relations, functions, and their properties', '55555555-2222-2222-2222-222222222222', false),
    ('22222222-2222-2222-2222-222222222223', 'Combinatorics', 'Counting principles, permutations, combinations, and pigeonhole principle', '55555555-2222-2222-2222-222222222222', false),
    ('22222222-2222-2222-2222-222222222224', 'Graph Theory', 'Basic graph concepts, trees, and graph algorithms', '55555555-2222-2222-2222-222222222222', true),
    ('22222222-2222-2222-2222-222222222225', 'Finite Automata', 'Regular languages, finite state machines, and regular expressions', '55555555-2222-2222-2222-222222222222', true),
    ('22222222-2222-2222-2222-222222222226', 'Computability Theory', 'Turing machines, decidability, and computational complexity', '55555555-2222-2222-2222-222222222222', true);

  -- Insert Topics for CS 251
  INSERT INTO topics (id, name, description, class_id, prerequisite) VALUES
    ('33333333-3333-3333-3333-333333333331', 'Algorithm Analysis', 'Big-O notation, time and space complexity analysis', '66666666-3333-3333-3333-333333333333', false),
    ('33333333-3333-3333-3333-333333333332', 'Linear Data Structures', 'Arrays, linked lists, stacks, and queues', '66666666-3333-3333-3333-333333333333', false),
    ('33333333-3333-3333-3333-333333333333', 'Trees and Heaps', 'Binary trees, BSTs, AVL trees, and heap data structures', '66666666-3333-3333-3333-333333333333', true),
    ('33333333-3333-3333-3333-333333333334', 'Hash Tables', 'Hash functions, collision resolution, and hash table implementation', '66666666-3333-3333-3333-333333333333', true),
    ('33333333-3333-3333-3333-333333333335', 'Graph Algorithms', 'Graph representation, traversal, shortest paths, and MST algorithms', '66666666-3333-3333-3333-333333333333', true),
    ('33333333-3333-3333-3333-333333333336', 'Sorting Algorithms', 'Comparison-based and non-comparison sorting algorithms', '66666666-3333-3333-3333-333333333333', false);

  -- Insert Topics for CS 381
  INSERT INTO topics (id, name, description, class_id, prerequisite) VALUES
    ('44444444-4444-4444-4444-444444444441', 'Divide and Conquer', 'Divide and conquer paradigm and recurrence relations', '77777777-4444-4444-4444-444444444444', false),
    ('44444444-4444-4444-4444-444444444442', 'Dynamic Programming', 'Optimal substructure and overlapping subproblems', '77777777-4444-4444-4444-444444444444', true),
    ('44444444-4444-4444-4444-444444444443', 'Greedy Algorithms', 'Greedy choice property and optimization problems', '77777777-4444-4444-4444-444444444444', true),
    ('44444444-4444-4444-4444-444444444444', 'Network Flow', 'Maximum flow algorithms and applications', '77777777-4444-4444-4444-444444444444', true),
    ('44444444-4444-4444-4444-444444444445', 'NP-Completeness', 'P vs NP, NP-complete problems, and reductions', '77777777-4444-4444-4444-444444444444', true),
    ('44444444-4444-4444-4444-444444444446', 'Approximation Algorithms', 'Approximation ratios and polynomial-time approximation schemes', '77777777-4444-4444-4444-444444444444', true);

  -- Insert Comprehensive Events for CS 180
  INSERT INTO events (id, name, description, document_type, time, schedule_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111111', 'Homework 1: Variables and Control', 'Basic programming exercises covering variables, data types, and control structures', 'homework', '2024-09-15 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111112', 'Project 1: Simple Calculator', 'Create a basic calculator application using object-oriented principles', 'project', '2024-10-01 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111113', 'Quiz 1: OOP Fundamentals', 'Quiz covering classes, objects, and basic inheritance', 'quiz', '2024-09-20 14:30:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111114', 'Lab 3: File Processing', 'Hands-on lab for file input/output operations', 'lab', '2024-09-25 16:20:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111115', 'Midterm Exam', 'Comprehensive midterm covering first half of course material', 'midterm', '2024-10-15 19:00:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111116', 'Project 2: GUI Application', 'Design and implement a complete GUI application', 'project', '2024-11-15 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-111111111117', 'Homework 4: Exception Handling', 'Practice with try-catch blocks and custom exceptions', 'homework', '2024-10-30 23:59:00', 'aaaaaaaa-1111-1111-1111-111111111111');

  -- Insert Events for CS 182
  INSERT INTO events (id, name, description, document_type, time, schedule_id) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-222222222221', 'Homework 1: Logic Proofs', 'Practice with propositional and predicate logic proofs', 'homework', '2024-09-18 23:59:00', 'bbbbbbbb-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-222222222222', 'Quiz 1: Set Theory', 'Quiz on sets, relations, and functions', 'quiz', '2024-09-25 14:30:00', 'bbbbbbbb-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-222222222223', 'Project 1: Combinatorics Problems', 'Solve complex counting and probability problems', 'project', '2024-10-10 23:59:00', 'bbbbbbbb-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-222222222224', 'Lab 2: Graph Algorithms', 'Implement basic graph traversal algorithms', 'lab', '2024-10-05 16:20:00', 'bbbbbbbb-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-222222222225', 'Midterm Exam', 'Midterm covering logic, sets, and combinatorics', 'midterm', '2024-10-20 19:00:00', 'bbbbbbbb-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-222222222226', 'Homework 3: Finite Automata', 'Design DFAs and NFAs for regular languages', 'homework', '2024-11-05 23:59:00', 'bbbbbbbb-1111-1111-1111-111111111111');

  -- Insert Events for CS 251
  INSERT INTO events (id, name, description, document_type, time, schedule_id) VALUES
    ('cccccccc-cccc-cccc-cccc-333333333331', 'Homework 1: Big-O Analysis', 'Analyze time complexity of various algorithms', 'homework', '2024-09-12 23:59:00', 'cccccccc-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-333333333332', 'Lab 1: Linked Lists', 'Implement singly and doubly linked lists', 'lab', '2024-09-15 16:20:00', 'cccccccc-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-333333333333', 'Project 1: Binary Search Tree', 'Complete BST implementation with all operations', 'project', '2024-10-05 23:59:00', 'cccccccc-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-333333333334', 'Quiz 2: Hash Tables', 'Quiz on hash functions and collision resolution', 'quiz', '2024-10-12 14:30:00', 'cccccccc-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-333333333335', 'Midterm Exam', 'Comprehensive exam on data structures', 'midterm', '2024-10-25 19:00:00', 'cccccccc-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-333333333336', 'Project 2: Graph Implementation', 'Implement graph with DFS, BFS, and shortest path algorithms', 'project', '2024-11-20 23:59:00', 'cccccccc-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-333333333337', 'Lab 4: Sorting Algorithms', 'Implement and compare various sorting algorithms', 'lab', '2024-11-10 16:20:00', 'cccccccc-1111-1111-1111-111111111111');

  -- Insert Events for CS 381
  INSERT INTO events (id, name, description, document_type, time, schedule_id) VALUES
    ('dddddddd-dddd-dddd-dddd-444444444441', 'Homework 1: Recurrence Relations', 'Solve recurrences using Master Theorem and substitution method', 'homework', '2024-09-20 23:59:00', 'dddddddd-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-444444444442', 'Project 1: Dynamic Programming', 'Implement solutions to classic DP problems', 'project', '2024-10-15 23:59:00', 'dddddddd-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-444444444443', 'Quiz 1: Divide and Conquer', 'Quiz on divide and conquer algorithm design', 'quiz', '2024-09-30 14:30:00', 'dddddddd-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-444444444444', 'Lab 2: Network Flow', 'Implement Ford-Fulkerson algorithm for max flow', 'lab', '2024-10-20 16:20:00', 'dddddddd-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-444444444445', 'Midterm Exam', 'Exam covering algorithm design paradigms', 'midterm', '2024-11-01 19:00:00', 'dddddddd-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-444444444446', 'Homework 3: NP-Completeness', 'Prove NP-completeness through reductions', 'homework', '2024-11-15 23:59:00', 'dddddddd-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-444444444447', 'Project 2: Approximation Algorithms', 'Implement approximation algorithms for NP-hard problems', 'project', '2024-12-05 23:59:00', 'dddddddd-1111-1111-1111-111111111111');
