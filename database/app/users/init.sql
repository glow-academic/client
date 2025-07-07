-- For Auth.js - Updated to match NextAuth Drizzle adapter requirements
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE verification_token
(
  identifier TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL,
 
  PRIMARY KEY (identifier, token)
);
 
CREATE TABLE accounts
(
  id SERIAL,
  "userId" INTEGER NOT NULL,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  id_token TEXT,
  scope TEXT,
  session_state TEXT,
  token_type TEXT,
 
  PRIMARY KEY (id)
);
 
CREATE TABLE sessions
(
  id SERIAL,
  "userId" INTEGER NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  "sessionToken" VARCHAR(255) NOT NULL,
 
  PRIMARY KEY (id)
);
 
CREATE TABLE users
(
  id SERIAL,
  name VARCHAR(255),
  email VARCHAR(255),
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
 
  PRIMARY KEY (id)
);

CREATE TYPE profile_role AS ENUM ('admin', 'instructional', 'instructor', 'ta');

CREATE TABLE profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    INTEGER     NULL REFERENCES users(id) ON DELETE CASCADE,
  last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL,
  alias      TEXT        NOT NULL,
  viewed_intro BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role       profile_role NOT NULL DEFAULT 'ta',
  class_ids  UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[],
  active     BOOLEAN     NOT NULL DEFAULT FALSE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('965bd24f-dfae-4063-b370-e1373df46322', 'Ashok', 'Saravanan', 'sarava18', true, 'admin', ARRAY[]::UUID[]),
  ('6a2518eb-eba7-4650-aee0-d387c3fb8265', 'Alex', 'Siladie', 'asiladie', true, 'admin', ARRAY[]::UUID[]),
  ('34f445d6-7318-45a7-ba49-086b85b76b85', 'Ethan', 'Dickey', 'dickeye', true, 'admin', ARRAY[]::UUID[]);

-- Admin and Instructional Users
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sarah', 'Chen', 'sarah.chen', true, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('11111111-aaaa-bbbb-cccc-111111111111', 'Michael', 'Rodriguez', 'michael.rodriguez', true, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('22222222-aaaa-bbbb-cccc-222222222222', 'Emily', 'Johnson', 'emily.johnson', true, 'instructional', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('33333333-aaaa-bbbb-cccc-333333333333', 'David', 'Kim', 'david.kim', false, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('44444444-aaaa-bbbb-cccc-444444444444', 'Lisa', 'Wang', 'lisa.wang', true, 'instructor', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('55555555-aaaa-bbbb-cccc-555555555555', 'James', 'Thompson', 'james.thompson', true, 'instructor', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- TAs for CS 180 (Problem Solving And Object-Oriented Programming)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Nina', 'Park', 'nina.park', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Rohan', 'Saxena', 'rohan.saxena', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Saket', 'Shi', 'saket.shi', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('abcdef12-3456-7890-abcd-ef1234567890', 'Samarth', 'Soe', 'samarth.soe', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'Nikita', 'Park', 'nikita.park', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180001-1111-2222-3333-444444444444', 'Alex', 'Chen', 'alex.chen', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180002-1111-2222-3333-444444444444', 'Maya', 'Patel', 'maya.patel', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]);

-- TAs for CS 182 (Foundations Of Computer Science)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Richie', 'Qian', 'richie.qian', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('12345678-abcd-efab-cdef-123456789abc', 'Tony', 'Xu', 'tony.xu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('abcd1234-efab-cdef-abcd-123456abcdef', 'Yuting', 'Zhou', 'yuting.zhou', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182001-2222-3333-4444-555555555555', 'Jordan', 'Lee', 'jordan.lee', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182002-2222-3333-4444-555555555555', 'Priya', 'Sharma', 'priya.sharma', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182003-2222-3333-4444-555555555555', 'Kevin', 'Zhang', 'kevin.zhang', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]);

-- TAs for CS 251 (Data Structures And Algorithms)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Pranav', 'Patel', 'pranav.patel', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('87654321-dcba-fedc-baef-987654321cba', 'Tayden', 'Xiao', 'tayden.xiao', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251001-3333-4444-5555-666666666666', 'Sophia', 'Martinez', 'sophia.martinez', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251002-3333-4444-5555-666666666666', 'Ryan', 'O''Connor', 'ryan.oconnor', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251003-3333-4444-5555-666666666666', 'Aisha', 'Johnson', 'aisha.johnson', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251004-3333-4444-5555-666666666666', 'Daniel', 'Kim', 'daniel.kim', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]);

-- TAs for CS 381 (Introduction To The Analysis Of Algorithms)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('12ab34cd-56ef-78ab-90cd-12ef34567890', 'William', 'Yoon', 'william.yoon', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381001-4444-5555-6666-777777777777', 'Isabella', 'Garcia', 'isabella.garcia', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381002-4444-5555-6666-777777777777', 'Ethan', 'Brown', 'ethan.brown', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381003-4444-5555-6666-777777777777', 'Zoe', 'Wilson', 'zoe.wilson', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381004-4444-5555-6666-777777777777', 'Marcus', 'Davis', 'marcus.davis', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- Multi-Class TAs (TAs who work across multiple classes)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('c5abc001-aaaa-bbbb-cccc-dddddddddddd', 'Grace', 'Liu', 'grace.liu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5abc002-aaaa-bbbb-cccc-dddddddddddd', 'Nathan', 'Singh', 'nathan.singh', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'Emma', 'Rodriguez', 'emma.rodriguez', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc004-aaaa-bbbb-cccc-dddddddddddd', 'Lucas', 'Thompson', 'lucas.thompson', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc005-aaaa-bbbb-cccc-dddddddddddd', 'Chloe', 'Anderson', 'chloe.anderson', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]);

-- NEW TA ACCOUNTS FOR BULK TESTING
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
-- CS-180  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916601', 'Harper', 'Nguyen', 'harper.nguyen', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916602', 'Diego', 'Alvarez', 'diego.alvarez', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
-- CS-182  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916603', 'Lila', 'Banerjee', 'lila.banerjee', true , 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916604', 'Owen', 'Foster', 'owen.foster', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
-- CS-251  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916605', 'Sofia', 'Lombardi', 'sofia.lombardi', true , 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916606', 'Noah', 'Rasmussen', 'noah.rasmussen', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
-- CS-381  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916607', 'John', 'Doe', 'john.doe', true , 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916608', 'Henry', 'Carter', 'henry.carter', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
-- multi-class ---------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916609', 'Ava', 'Petrova', 'ava.petrova', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111','55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916610', 'Leo', 'Müller', 'leo.muller', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333','77777777-4444-4444-4444-444444444444']::UUID[]);

-- TA TRAINING COHORT MEMBERS
-- Week 1 - Fundamentals TAs (New TAs just starting)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('1a001111-1111-1111-1111-111111111111', 'Amanda', 'Roberts', 'amanda.roberts', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('1a001111-2222-2222-2222-222222222222', 'Brandon', 'Taylor', 'brandon.taylor', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('1a001111-3333-3333-3333-333333333333', 'Chloe', 'Mitchell', 'chloe.mitchell', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('1a001111-4444-4444-4444-444444444444', 'Derek', 'Campbell', 'derek.campbell', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('1a001111-5555-5555-5555-555555555555', 'Emma', 'Foster', 'emma.foster', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]);

-- Week 2 - Advanced Techniques TAs (Developing skills)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('1a002222-1111-1111-1111-111111111111', 'Felix', 'Garcia', 'felix.garcia', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('1a002222-2222-2222-2222-222222222222', 'Grace', 'Henderson', 'grace.henderson', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('1a002222-3333-3333-3333-333333333333', 'Henry', 'Jackson', 'henry.jackson', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('1a002222-4444-4444-4444-444444444444', 'Ivy', 'Martinez', 'ivy.martinez', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('1a002222-5555-5555-5555-555555555555', 'Jake', 'Nelson', 'jake.nelson', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]);

-- Week 3 - Specialization TAs (Advanced/experienced)
INSERT INTO profiles (id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('1a003333-1111-1111-1111-111111111111', 'Kara', 'Phillips', 'kara.phillips', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('1a003333-2222-2222-2222-222222222222', 'Liam', 'Rodriguez', 'liam.rodriguez', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('1a003333-3333-3333-3333-333333333333', 'Maya', 'Stewart', 'maya.stewart', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('1a003333-4444-4444-4444-444444444444', 'Noah', 'Turner', 'noah.turner', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('1a003333-5555-5555-5555-555555555555', 'Olivia', 'Walker', 'olivia.walker', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]);