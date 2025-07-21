-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE cohorts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NULL,
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  profile_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], 
  default_cohort BOOLEAN     NOT NULL           DEFAULT FALSE,
  simulation_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[]
);


-- ============================================================================
-- FALL 2025 TRAINING COHORTS
-- ============================================================================

INSERT INTO cohorts (id, title, description, profile_ids, active, default_cohort, simulation_ids) VALUES
  ('f2511b00-aaaa-bbbb-cccc-dddddddddddd', 'Fall 25 W1 Beginner', 'Foundational TA training focusing on basic student interaction skills, handling confused students, and time management. Designed for new TAs with limited tutoring experience.',
   ARRAY[
     -- Instructors supervising CS 180 and CS 182 courses
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-bbbb-cccc-111111111111', '33333333-aaaa-bbbb-cccc-333333333333',
     -- New TAs for beginner training
     '1a001111-1111-1111-1111-111111111111', '1a001111-2222-2222-2222-222222222222', '1a001111-3333-3333-3333-333333333333', 
     '1a001111-4444-4444-4444-444444444444', '1a001111-5555-5555-5555-555555555555',
     -- Additional CS 180 TAs
     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'c5180001-1111-2222-3333-444444444444', 'c5180002-1111-2222-3333-444444444444', '99b90118-7b9e-4e12-8e81-d7ccc2916601'
   ]::UUID[], true, true, ARRAY[
     'f2511b01-aaaa-bbbb-cccc-dddddddddddd',
     'f2511b02-aaaa-bbbb-cccc-dddddddddddd',
     'f2511b03-aaaa-bbbb-cccc-dddddddddddd'
   ]::UUID[]),

  ('f2511a00-aaaa-bbbb-cccc-dddddddddddd', 'Fall 25 W1 Advanced', 'Advanced TA training focusing on complex technical concepts, handling frustrated students, and maintaining composure under pressure. For experienced TAs ready for challenging scenarios.',
   ARRAY[
     -- Instructors supervising CS 251 and CS 381 courses
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-aaaa-bbbb-cccc-444444444444', '55555555-aaaa-bbbb-cccc-555555555555',
     -- Advanced TAs from CS 251 and CS 381
     'cccccccc-cccc-cccc-cccc-cccccccccccc', '87654321-dcba-fedc-baef-987654321cba', 'c5251001-3333-4444-5555-666666666666',
     '12ab34cd-56ef-78ab-90cd-12ef34567890', 'c5381001-4444-5555-6666-777777777777', 'c5381002-4444-5555-6666-777777777777',
     -- Multi-class experienced TAs
     'c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'c5abc004-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916610'
   ]::UUID[], true, true, ARRAY[
     'f2511a01-aaaa-bbbb-cccc-dddddddddddd',
     'f2511a02-aaaa-bbbb-cccc-dddddddddddd',
     'f2511a03-aaaa-bbbb-cccc-dddddddddddd'
   ]::UUID[]),

  ('f2522100-aaaa-bbbb-cccc-dddddddddddd', 'Fall 25 W2 Beginner', 'Document-based training for lower-level CS courses. Focus on using course materials effectively while maintaining student engagement and explaining foundational concepts clearly.',
   ARRAY[
     -- Instructors for CS 180, CS 182, and CS 251
     '11111111-aaaa-bbbb-cccc-111111111111', '22222222-aaaa-bbbb-cccc-222222222222', '33333333-aaaa-bbbb-cccc-333333333333',
     -- Week 2 training TAs
     '1a002222-1111-1111-1111-111111111111', '1a002222-2222-2222-2222-222222222222', '1a002222-3333-3333-3333-333333333333',
     '1a002222-5555-5555-5555-555555555555',
     -- TAs from CS 180, CS 182, and CS 251
     'abcdef12-3456-7890-abcd-ef1234567890', 'c5182001-2222-3333-4444-555555555555', 'c5182002-2222-3333-4444-555555555555',
     'c5251002-3333-4444-5555-666666666666', 'c5251003-3333-4444-5555-666666666666', 'c5abc001-aaaa-bbbb-cccc-dddddddddddd',
     'c5abc002-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916603', '99b90118-7b9e-4e12-8e81-d7ccc2916605'
   ]::UUID[], true, true, ARRAY[
     'f2522101-aaaa-bbbb-cccc-dddddddddddd',
     'f2522102-aaaa-bbbb-cccc-dddddddddddd',
     'f2522103-aaaa-bbbb-cccc-dddddddddddd'
   ]::UUID[]),

  ('f2522200-aaaa-bbbb-cccc-dddddddddddd', 'Fall 25 W2 Advanced', 'Document-based training for upper-level CS courses. Advanced technical communication skills, handling high-stakes academic pressure, and complex theoretical concepts.',
   ARRAY[
     -- Instructors for advanced courses
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-aaaa-bbbb-cccc-222222222222', '55555555-aaaa-bbbb-cccc-555555555555',
     -- Week 2 advanced training TAs
     '1a002222-4444-4444-4444-444444444444',
     -- Advanced TAs from CS 381
     'c5381003-4444-5555-6666-777777777777', 'c5381004-4444-5555-6666-777777777777', 'c5abc005-aaaa-bbbb-cccc-dddddddddddd',
     -- Multi-class advanced TAs
     'c5abc004-aaaa-bbbb-cccc-dddddddddddd', '99b90118-7b9e-4e12-8e81-d7ccc2916607', '99b90118-7b9e-4e12-8e81-d7ccc2916608',
     '99b90118-7b9e-4e12-8e81-d7ccc2916610'
   ]::UUID[], true, true, ARRAY[
     'f2522201-aaaa-bbbb-cccc-dddddddddddd', -- Analysis of Algorithms
     'f2522202-aaaa-bbbb-cccc-dddddddddddd', -- Networking
     'f2522203-aaaa-bbbb-cccc-dddddddddddd'  -- Machine Learning
   ]::UUID[]),

  ('f2533c00-aaaa-bbbb-cccc-dddddddddddd', 'Fall 25 W3 Communication', 'Specialized training for sensitive communication topics including campus belonging, academic equity, and cultural sensitivity. Essential skills for all TAs working with diverse student populations.',
   ARRAY[
     -- All instructors for comprehensive communication training
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-bbbb-cccc-111111111111', '22222222-aaaa-bbbb-cccc-222222222222',
     '33333333-aaaa-bbbb-cccc-333333333333', '44444444-aaaa-bbbb-cccc-444444444444', '55555555-aaaa-bbbb-cccc-555555555555',
     -- Instructional staff for communication expertise
     'a1bc0cb2-c9a2-4c80-8dd5-75156eb58ce1', 'b44a9d96-2b2e-4bcc-88e7-58cb6214aac1', 'c7c6f71a-2a4b-4e87-9320-4f444a603519',
     -- Week 3 specialized training TAs
     '1a003333-1111-1111-1111-111111111111', '1a003333-2222-2222-2222-222222222222', '1a003333-3333-3333-3333-333333333333',
     '1a003333-4444-4444-4444-444444444444', '1a003333-5555-5555-5555-555555555555',
     -- Representative TAs from all course levels
     'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'c5251004-3333-4444-5555-666666666666',
     '99b90118-7b9e-4e12-8e81-d7ccc2916604', '99b90118-7b9e-4e12-8e81-d7ccc2916606', '99b90118-7b9e-4e12-8e81-d7ccc2916609'
   ]::UUID[], true, true, ARRAY[
     'f2533c01-aaaa-bbbb-cccc-dddddddddddd',
     'f2533c02-aaaa-bbbb-cccc-dddddddddddd',
     'f2533c03-aaaa-bbbb-cccc-dddddddddddd'
   ]::UUID[]);