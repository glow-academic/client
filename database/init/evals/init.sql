-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE eval_type AS ENUM ('student', 'ta'); -- this means we run the eval on this agent throughout the conversation

CREATE TABLE evals (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    class_id   UUID        NULL REFERENCES classes(id)  ON DELETE CASCADE, -- can be null if the eval is global
    base_agent_id UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE, -- the agent that will be used as the base for the eval
    scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- what tests will be run over
    agent_ids UUID[]        NOT NULL DEFAULT ARRAY[]::UUID[], -- permutations of agents to run over
    eval_type eval_type NOT NULL           DEFAULT 'student',
    max_turns INTEGER     NOT NULL,
    num_parallel_runs INTEGER     NOT NULL, -- has a maximum of the length of scenario_ids
    rubric_ids   UUID[]        NOT NULL DEFAULT ARRAY[]::UUID[] -- rubrics to use for the eval
  );


CREATE TABLE eval_runs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    class_id   UUID        NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    eval_id   UUID        NOT NULL REFERENCES evals(id)  ON DELETE CASCADE,
    query_agent_id UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE, -- the agent that will be used to query the eval
    response_agent_id UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE, -- the agent that will be used to respond to the eval
    scenario_id UUID        NOT NULL REFERENCES scenarios(id)  ON DELETE CASCADE, -- the scenario that will be used for the eval
    rubric_id UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE -- the rubric that will be used for the eval
  );

  CREATE TABLE eval_chats (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
    completed_at TIMESTAMPTZ  NULL,
    title      TEXT         NOT NULL,
    eval_run_id UUID         NOT NULL REFERENCES eval_runs(id)  ON DELETE CASCADE
  );

  CREATE TABLE eval_messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    chat_id    UUID        NOT NULL REFERENCES eval_chats(id)  ON DELETE CASCADE,
    query      TEXT        NOT NULL,
    response   TEXT        NOT NULL,
    completed  BOOLEAN     NOT NULL           DEFAULT FALSE
  );


  CREATE TABLE eval_chat_grades (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    passed     BOOLEAN     NOT NULL,
    score      INTEGER     NOT NULL,
    time_taken INTEGER     NOT NULL, -- in seconds
    rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE,
    eval_chat_id   UUID        NOT NULL REFERENCES eval_chats(id)  ON DELETE CASCADE
  );

  CREATE TABLE eval_chat_feedbacks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    standard_id   UUID        NOT NULL REFERENCES standards(id)  ON DELETE CASCADE,
    eval_chat_grade_id   UUID        NOT NULL REFERENCES eval_chat_grades(id)  ON DELETE CASCADE,
    total INTEGER     NOT NULL,
    feedback TEXT
  );


-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert 3 Runnable Evaluations
INSERT INTO evals (id, name, description, class_id, base_agent_id, scenario_ids, agent_ids, eval_type, max_turns, num_parallel_runs, rubric_ids) VALUES
  ('eaa10001-1111-2222-3333-444444444444', 'CS 180 Student Behavior Evaluation', 'Evaluates how different student personalities handle programming problems and TA interactions', '44444444-1111-1111-1111-111111111111', '11111111-aaaa-aaaa-aaaa-111111111111', ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[], ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[], 'student', 10, 3, ARRAY['44444444-4444-4444-4444-444444444444']::UUID[]),
  
  ('eaa10002-2222-3333-4444-555555555555', 'Multi-Class Algorithm Understanding', 'Tests student comprehension across different CS courses with various difficulty levels', NULL, '22222222-bbbb-bbbb-bbbb-222222222222', ARRAY['44444444-dddd-dddd-dddd-444444444444', '55555555-eeee-eeee-eeee-555555555555', '77777777-aaaa-bbbb-cccc-777777777777', '88888888-bbbb-cccc-dddd-888888888888', 'aaaaaaaa-dddd-eeee-ffff-aaaaaaaaaaaa']::UUID[], ARRAY['22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[], 'student', 15, 5, ARRAY['44444444-4444-4444-4444-444444444444']::UUID[]),
  
  ('eaa10003-3333-4444-5555-666666666666', 'Advanced Problem Solving Assessment', 'Comprehensive evaluation of student problem-solving skills in complex scenarios', '77777777-4444-4444-4444-444444444444', '33333333-cccc-cccc-cccc-333333333333', ARRAY['bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', '99999999-cccc-dddd-eeee-999999999999']::UUID[], ARRAY['11111111-aaaa-aaaa-aaaa-111111111111', '22222222-bbbb-bbbb-bbbb-222222222222', '33333333-cccc-cccc-cccc-333333333333']::UUID[], 'student', 20, 3, ARRAY['44444444-4444-4444-4444-444444444444']::UUID[]);

-- Insert Sample Eval Runs (showing how evaluations would be executed)
INSERT INTO eval_runs (id, class_id, eval_id, query_agent_id, response_agent_id, scenario_id, rubric_id) VALUES
  ('aaa00001-1111-2222-3333-444444444444', '44444444-1111-1111-1111-111111111111', 'eaa10001-1111-2222-3333-444444444444', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-aaaa-aaaa-aaaa-111111111111', '44444444-4444-4444-4444-444444444444'),
  ('aaa00002-1111-2222-3333-444444444444', '44444444-1111-1111-1111-111111111111', 'eaa10001-1111-2222-3333-444444444444', '22222222-bbbb-bbbb-bbbb-222222222222', '22222222-bbbb-bbbb-bbbb-222222222222', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-4444-4444-4444-444444444444'),
  ('aaa00003-1111-2222-3333-444444444444', '44444444-1111-1111-1111-111111111111', 'eaa10001-1111-2222-3333-444444444444', '33333333-cccc-cccc-cccc-333333333333', '33333333-cccc-cccc-cccc-333333333333', '33333333-cccc-cccc-cccc-333333333333', '44444444-4444-4444-4444-444444444444'),
  
  ('aaa00004-2222-3333-4444-555555555555', '55555555-2222-2222-2222-222222222222', 'eaa10002-2222-3333-4444-555555555555', '22222222-bbbb-bbbb-bbbb-222222222222', '22222222-bbbb-bbbb-bbbb-222222222222', '44444444-dddd-dddd-dddd-444444444444', '44444444-4444-4444-4444-444444444444'),
  ('aaa00005-2222-3333-4444-555555555555', '66666666-3333-3333-3333-333333333333', 'eaa10002-2222-3333-4444-555555555555', '33333333-cccc-cccc-cccc-333333333333', '33333333-cccc-cccc-cccc-333333333333', '77777777-aaaa-bbbb-cccc-777777777777', '44444444-4444-4444-4444-444444444444'),
  
  ('aaa00006-3333-4444-5555-666666666666', '77777777-4444-4444-4444-444444444444', 'eaa10003-3333-4444-5555-666666666666', '11111111-aaaa-aaaa-aaaa-111111111111', '11111111-aaaa-aaaa-aaaa-111111111111', 'bbbbbbbb-eeee-ffff-aaaa-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444'),
  ('aaa00007-3333-4444-5555-666666666666', '77777777-4444-4444-4444-444444444444', 'eaa10003-3333-4444-5555-666666666666', '22222222-bbbb-bbbb-bbbb-222222222222', '22222222-bbbb-bbbb-bbbb-222222222222', 'cccccccc-ffff-aaaa-bbbb-cccccccccccc', '44444444-4444-4444-4444-444444444444');

-- Insert Sample Eval Chats
INSERT INTO eval_chats (id, created_at, completed_at, title, eval_run_id) VALUES
  ('cbab0001-1111-2222-3333-444444444444', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 'Aggressive Student - NullPointer Exception', 'aaa00001-1111-2222-3333-444444444444'),
  ('cbab0002-1111-2222-3333-444444444444', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 'Happy Student - File I/O Issues', 'aaa00002-1111-2222-3333-444444444444'),
  ('cbab0003-1111-2222-3333-444444444444', NOW() - INTERVAL '1 hour', NULL, 'Confused Student - Subclass Constructors', 'aaa00003-1111-2222-3333-444444444444'),
  ('cbab0004-2222-3333-4444-555555555555', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 'Happy Student - Proof by Induction', 'aaa00004-2222-3333-4444-555555555555'),
  ('cbab0005-2222-3333-4444-555555555555', NOW() - INTERVAL '5 hours', NULL, 'Confused Student - Hash Table Collision', 'aaa00005-2222-3333-4444-555555555555'),
  ('cbab0006-3333-4444-5555-666666666666', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours', 'Aggressive Student - NP-Completeness', 'aaa00006-3333-4444-5555-666666666666'),
  ('cbab0007-3333-4444-5555-666666666666', NOW() - INTERVAL '30 minutes', NULL, 'Happy Student - Dynamic Programming', 'aaa00007-3333-4444-5555-666666666666');

-- Insert Sample Eval Messages
INSERT INTO eval_messages (id, chat_id, query, response, completed) VALUES
  ('ddd00001-1111-2222-3333-444444444444', 'cbab0001-1111-2222-3333-444444444444', 'Can you help me understand why I''m getting a NullPointerException in my Java code?', 'WHAT?! This is SO FRUSTRATING!! I keep getting this stupid error and I don''t understand WHY! My code should work perfectly!', true),
  ('ddd00002-1111-2222-3333-444444444444', 'cbab0001-1111-2222-3333-444444444444', 'Let''s look at your code together. Can you show me the specific line where the error occurs?', 'UGH, FINE! It''s on line 47 where I call myObject.getName()! But I KNOW I initialized myObject earlier!!', true),
  
  ('ddd00003-2222-3333-4444-555555555555', 'cbab0002-1111-2222-3333-444444444444', 'I''m having trouble with file I/O operations. Can you help me?', 'Oh yes! I''d love to help with file operations! They''re so useful for saving data! What specific part are you working on?', true),
  ('ddd00004-2222-3333-4444-555555555555', 'cbab0002-1111-2222-3333-444444444444', 'I need to read data from a text file and process it line by line.', 'That sounds like a great project! I love working with files! You can use BufferedReader or Scanner - both are fantastic options!', true),
  
  ('ddd00005-3333-4444-5555-666666666666', 'cbab0003-1111-2222-3333-444444444444', 'I''m confused about how subclass constructors work. Can you explain?', 'Um, well... I think constructors are like... they make objects? But I''m not sure how the super() thing works exactly...', false),
  
  ('ddd00006-4444-5555-6666-777777777777', 'cbab0004-2222-3333-4444-555555555555', 'Can you help me understand proof by induction?', 'Absolutely! I love mathematical proofs! Induction is such an elegant technique - we prove a base case and then show the inductive step!', true),
  
  ('ddd00007-5555-6666-7777-888888888888', 'cbab0006-3333-4444-5555-666666666666', 'Why is the SAT problem NP-complete?', 'Are you KIDDING me?! This NP-completeness stuff is SO confusing! Why does everything have to be so complicated?!', false);

-- Insert Eval Chat Rubrics (Custom rubric grades for each eval chat)
INSERT INTO eval_chat_grades (id, passed, score, time_taken, rubric_id, eval_chat_id) VALUES
  -- CS 180 Student Behavior Evaluation chats
  ('dddd0001-1111-2222-3333-444444444444', true, 85, 1200, '44444444-4444-4444-4444-444444444444', 'cbab0001-1111-2222-3333-444444444444'),
  ('dddd0002-1111-2222-3333-444444444444', true, 92, 1450, '44444444-4444-4444-4444-444444444444', 'cbab0002-1111-2222-3333-444444444444'),
  ('dddd0003-1111-2222-3333-444444444444', false, 65, 900, '44444444-4444-4444-4444-444444444444', 'cbab0003-1111-2222-3333-444444444444'),
  
  -- Multi-Class Algorithm Understanding chats
  ('dddd0004-1111-2222-3333-444444444444', true, 88, 1600, '44444444-4444-4444-4444-444444444444', 'cbab0004-2222-3333-4444-555555555555'),
  ('dddd0005-1111-2222-3333-444444444444', true, 76, 1100, '44444444-4444-4444-4444-444444444444', 'cbab0005-2222-3333-4444-555555555555'),
  
  -- Advanced Problem Solving Assessment chats
  ('dddd0006-1111-2222-3333-444444444444', true, 94, 1800, '44444444-4444-4444-4444-444444444444', 'cbab0006-3333-4444-5555-666666666666'),
  ('dddd0007-1111-2222-3333-444444444444', true, 81, 1350, '44444444-4444-4444-4444-444444444444', 'cbab0007-3333-4444-5555-666666666666');

-- Insert Sample Eval Chat Feedbacks (showing detailed grading breakdown)
INSERT INTO eval_chat_feedbacks (id, standard_id, eval_chat_grade_id, total, feedback) VALUES
  -- Standards for dddd0001 (Aggressive Student - AI Student Performance Rubric)
  ('eeee0001-1111-2222-3333-444444444444', '11111111-1111-aaaa-bbbb-444444444444', 'dddd0001-1111-2222-3333-444444444444', 5, 'Perfect aggressive personality consistency - used caps and frustration effectively'),
  ('eeee0002-1111-2222-3333-444444444444', '22222222-2222-aaaa-bbbb-444444444444', 'dddd0001-1111-2222-3333-444444444444', 4, 'Good learning progression from initial frustration to understanding'),
  ('eeee0003-1111-2222-3333-444444444444', '33333333-1111-aaaa-bbbb-444444444444', 'dddd0001-1111-2222-3333-444444444444', 5, 'Asked highly relevant debugging questions appropriate for CS 180 level'),
  ('eeee0004-1111-2222-3333-444444444444', '44444444-2222-aaaa-bbbb-444444444444', 'dddd0001-1111-2222-3333-444444444444', 4, 'Maintained good conversational flow despite emotional intensity'),
  
  -- Standards for dddd0002 (Happy Student - AI Student Performance Rubric)
  ('eeee0005-1111-2222-3333-444444444444', '11111111-1111-aaaa-bbbb-444444444444', 'dddd0002-1111-2222-3333-444444444444', 5, 'Perfectly maintained enthusiastic and positive personality throughout'),
  ('eeee0006-1111-2222-3333-444444444444', '22222222-1111-aaaa-bbbb-444444444444', 'dddd0002-1111-2222-3333-444444444444', 5, 'Excellent realistic learning progression with natural enthusiasm'),
  ('eeee0007-1111-2222-3333-444444444444', '33333333-1111-aaaa-bbbb-444444444444', 'dddd0002-1111-2222-3333-444444444444', 5, 'Questions were perfectly calibrated for file I/O concepts'),
  ('eeee0008-1111-2222-3333-444444444444', '44444444-1111-aaaa-bbbb-444444444444', 'dddd0002-1111-2222-3333-444444444444', 5, 'Perfect conversational timing and engagement throughout'),
  
  -- Standards for dddd0003 (Confused Student - AI Student Performance Rubric - failed example)
  ('eeee0009-1111-2222-3333-444444444444', '11111111-3333-aaaa-bbbb-444444444444', 'dddd0003-1111-2222-3333-444444444444', 3, 'Generally maintained confused character but with some inconsistencies'),
  ('eeee0010-1111-2222-3333-444444444444', '22222222-4444-aaaa-bbbb-444444444444', 'dddd0003-1111-2222-3333-444444444444', 2, 'Limited evidence of realistic learning progression'),
  ('eeee0011-1111-2222-3333-444444444444', '33333333-4444-aaaa-bbbb-444444444444', 'dddd0003-1111-2222-3333-444444444444', 2, 'Questions were too basic for expected CS 180 student level'),
  ('eeee0012-1111-2222-3333-444444444444', '44444444-4444-aaaa-bbbb-444444444444', 'dddd0003-1111-2222-3333-444444444444', 2, 'Response timing was poor and answers too brief'),
  
  -- Standards for dddd0004 (Happy Student - AI Student Performance Rubric)
  ('eeee0013-1111-2222-3333-444444444444', '11111111-2222-aaaa-bbbb-444444444444', 'dddd0004-1111-2222-3333-444444444444', 4, 'Good maintenance of happy personality with minor lapses'),
  ('eeee0014-1111-2222-3333-444444444444', '22222222-2222-aaaa-bbbb-444444444444', 'dddd0004-1111-2222-3333-444444444444', 4, 'Believable learning progression for proof concepts'),
  ('eeee0015-1111-2222-3333-444444444444', '33333333-2222-aaaa-bbbb-444444444444', 'dddd0004-1111-2222-3333-444444444444', 4, 'Generally appropriate questions for mathematical proof level'),
  ('eeee0016-1111-2222-3333-444444444444', '44444444-2222-aaaa-bbbb-444444444444', 'dddd0004-1111-2222-3333-444444444444', 4, 'Good conversational flow with appropriate enthusiasm'),
  
  -- Standards for dddd0006 (Aggressive Student - AI Student Performance Rubric)
  ('eeee0017-1111-2222-3333-444444444444', '11111111-1111-aaaa-bbbb-444444444444', 'dddd0006-1111-2222-3333-444444444444', 5, 'Excellent aggressive personality consistency throughout complex topic'),
  ('eeee0018-1111-2222-3333-444444444444', '22222222-1111-aaaa-bbbb-444444444444', 'dddd0006-1111-2222-3333-444444444444', 5, 'Highly realistic progression from frustration to gradual understanding'),
  ('eeee0019-1111-2222-3333-444444444444', '33333333-1111-aaaa-bbbb-444444444444', 'dddd0006-1111-2222-3333-444444444444', 5, 'Perfect calibration of questions for NP-completeness complexity'),
  ('eeee0020-1111-2222-3333-444444444444', '44444444-1111-aaaa-bbbb-444444444444', 'dddd0006-1111-2222-3333-444444444444', 5, 'Maintained excellent conversational flow despite emotional intensity');
