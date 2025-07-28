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

CREATE TYPE profile_role AS ENUM ('superadmin', 'admin', 'instructional', 'ta', 'guest');

CREATE TABLE profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    INTEGER     NULL REFERENCES users(id) ON DELETE CASCADE,
  last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL,
  alias      TEXT        NOT NULL,
  viewed_intro BOOLEAN   NOT NULL DEFAULT FALSE,
  viewed_chat BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role       profile_role NOT NULL DEFAULT 'guest',
  default_profile BOOLEAN   NOT NULL DEFAULT FALSE,
  active     BOOLEAN     NOT NULL DEFAULT FALSE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the default users, which will be used for emulation
INSERT INTO profiles (id, first_name, last_name, alias, role, default_profile, viewed_intro, viewed_chat) VALUES
  ('e1a1b2c3-d4e5-6789-0123-456789abcdef', 'Default', 'Superadmin', 'superadmin', 'superadmin', true, true, true),
  ('f2b2c3d4-e5f6-7890-1234-567890abcdef', 'Default', 'Admin', 'admin', 'admin', true, true, true),
  ('a3c3d4e5-f6a7-8901-2345-67890abcdef1', 'Default', 'Instructional', 'instructional', 'instructional', true, true, true),
  ('b4d4e5f6-a7b8-9012-3456-7890abcdef12', 'Default', 'TA', 'ta', 'ta', true, true, true),
  ('c5e5f6a7-b8c9-0123-4567-890abcdef123', 'Default', 'Guest', 'guest', 'guest', true, true, true);

-- Insert ZZ demo student (for testing purposes)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('b7e2c1d4-3f5a-4c8e-9a2b-1d6e7f8c9b0a', 'ZZ', 'Demo Student', 'ZZDemo.Student.dev_sp24_ta_training_dev', 'ta');


-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Superadmin Users
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('965bd24f-dfae-4063-b370-e1373df46322', 'Ashok', 'Saravanan', 'sarava18', 'superadmin'),
  ('6a2518eb-eba7-4650-aee0-d387c3fb8265', 'Alex', 'Siladie', 'asiladie', 'superadmin'),
  ('34f445d6-7318-45a7-ba49-086b85b76b85', 'Ethan', 'Dickey', 'dickeye', 'superadmin'),
  ('456878aa-12ca-464b-86fe-fa22ebe58614', 'Andres', 'Bejarano', 'abejara', 'superadmin');

-- Admin Users
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('c7c6f71a-2a4b-4e87-9320-4f444a603519', 'Justin', 'Gillingham', 'jdgillin','admin'),
  ('a1bc0cb2-c9a2-4c80-8dd5-75156eb58ce1', 'Houyame', 'Lkhider-Hudson', 'hlkhider', 'admin'),
  ('b44a9d96-2b2e-4bcc-88e7-58cb6214aac1', 'Quiondriya', 'Gee', 'qgee', 'admin'),
  ('34a3c43e-27ee-4924-9f61-be4ac9e370f2', 'Jonathan', 'Morris', 'morrisjb', 'admin'),
  ('fed71b5d-6170-4462-b919-e992f7716338', 'Max', 'Rees', 'mcrees', 'admin'),
  ('37ed3d71-c381-4933-a1eb-66e3d4e0b0ac', 'Nicholas', 'Brasovan', 'nbrasova', 'admin');

-- TAs for CS 180 (Problem Solving And Object-Oriented Programming)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Nina', 'Park', 'nina.park', 'ta'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Rohan', 'Saxena', 'rohan.saxena', 'ta'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Saket', 'Shi', 'saket.shi', 'ta'),
  ('abcdef12-3456-7890-abcd-ef1234567890', 'Samarth', 'Soe', 'samarth.soe', 'ta'),
  ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'Nikita', 'Park', 'nikita.park', 'ta'),
  ('c5180001-1111-2222-3333-444444444444', 'Alex', 'Chen', 'alex.chen', 'ta'),
  ('c5180002-1111-2222-3333-444444444444', 'Maya', 'Patel', 'maya.patel', 'ta');

-- TAs for CS 182 (Foundations Of Computer Science)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Richie', 'Qian', 'richie.qian', 'ta'),
  ('12345678-abcd-efab-cdef-123456789abc', 'Tony', 'Xu', 'tony.xu', 'ta'),
  ('abcd1234-efab-cdef-abcd-123456abcdef', 'Yuting', 'Zhou', 'yuting.zhou', 'ta'),
  ('c5182001-2222-3333-4444-555555555555', 'Jordan', 'Lee', 'jordan.lee', 'ta'),
  ('c5182002-2222-3333-4444-555555555555', 'Priya', 'Sharma', 'priya.sharma', 'ta'),
  ('c5182003-2222-3333-4444-555555555555', 'Kevin', 'Zhang', 'kevin.zhang', 'ta');

-- TAs for CS 251 (Data Structures And Algorithms)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Pranav', 'Patel', 'pranav.patel', 'ta'),
  ('87654321-dcba-fedc-baef-987654321cba', 'Tayden', 'Xiao', 'tayden.xiao', 'ta'),
  ('c5251001-3333-4444-5555-666666666666', 'Sophia', 'Martinez', 'sophia.martinez', 'ta'),
  ('c5251002-3333-4444-5555-666666666666', 'Ryan', 'O''Connor', 'ryan.oconnor', 'ta'),
  ('c5251003-3333-4444-5555-666666666666', 'Aisha', 'Johnson', 'aisha.johnson', 'ta'),
  ('c5251004-3333-4444-5555-666666666666', 'Daniel', 'Kim', 'daniel.kim', 'ta');

-- TAs for CS 381 (Introduction To The Analysis Of Algorithms)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('12ab34cd-56ef-78ab-90cd-12ef34567890', 'William', 'Yoon', 'william.yoon', 'ta'),
  ('c5381001-4444-5555-6666-777777777777', 'Isabella', 'Garcia', 'isabella.garcia', 'ta'),
  ('c5381002-4444-5555-6666-777777777777', 'Ethan', 'Brown', 'ethan.brown', 'ta'),
  ('c5381003-4444-5555-6666-777777777777', 'Zoe', 'Wilson', 'zoe.wilson', 'ta'),
  ('c5381004-4444-5555-6666-777777777777', 'Marcus', 'Davis', 'marcus.davis', 'ta');

-- Multi-Class TAs (TAs who work across multiple classes)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('c5abc001-aaaa-bbbb-cccc-dddddddddddd', 'Grace', 'Liu', 'grace.liu', 'ta'),
  ('c5abc002-aaaa-bbbb-cccc-dddddddddddd', 'Nathan', 'Singh', 'nathan.singh', 'ta'),
  ('c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'Emma', 'Rodriguez', 'emma.rodriguez', 'ta'),
  ('c5abc004-aaaa-bbbb-cccc-dddddddddddd', 'Lucas', 'Thompson', 'lucas.thompson', 'ta'),
  ('c5abc005-aaaa-bbbb-cccc-dddddddddddd', 'Chloe', 'Anderson', 'chloe.anderson', 'ta');

-- NEW TA ACCOUNTS FOR BULK TESTING
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
-- CS-180  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916601', 'Harper', 'Nguyen', 'harper.nguyen', 'ta'),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916602', 'Diego', 'Alvarez', 'diego.alvarez', 'ta'),
-- CS-182  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916603', 'Lila', 'Banerjee', 'lila.banerjee', 'ta'),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916604', 'Owen', 'Foster', 'owen.foster', 'ta'),
-- CS-251  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916605', 'Sofia', 'Lombardi', 'sofia.lombardi', 'ta'),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916606', 'Noah', 'Rasmussen', 'noah.rasmussen', 'ta'),
-- CS-381  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916607', 'John', 'Doe', 'john.doe', 'ta'),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916608', 'Henry', 'Carter', 'henry.carter', 'ta'),
-- multi-class ---------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916609', 'Ava', 'Petrova', 'ava.petrova', 'ta'),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916610', 'Leo', 'Müller', 'leo.muller', 'ta');

-- TA TRAINING COHORT MEMBERS
-- Week 1 - Fundamentals TAs (New TAs just starting)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('1a001111-1111-1111-1111-111111111111', 'Amanda', 'Roberts', 'amanda.roberts', 'ta'),
  ('1a001111-2222-2222-2222-222222222222', 'Brandon', 'Taylor', 'brandon.taylor', 'ta'),
  ('1a001111-3333-3333-3333-333333333333', 'Chloe', 'Mitchell', 'chloe.mitchell', 'ta'),
  ('1a001111-4444-4444-4444-444444444444', 'Derek', 'Campbell', 'derek.campbell', 'ta'),
  ('1a001111-5555-5555-5555-555555555555', 'Emma', 'Foster', 'emma.foster', 'ta');

-- Week 2 - Advanced Techniques TAs (Developing skills)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('1a002222-1111-1111-1111-111111111111', 'Felix', 'Garcia', 'felix.garcia', 'ta'),
  ('1a002222-2222-2222-2222-222222222222', 'Grace', 'Henderson', 'grace.henderson', 'ta'),
  ('1a002222-3333-3333-3333-333333333333', 'Henry', 'Jackson', 'henry.jackson', 'ta'),
  ('1a002222-4444-4444-4444-444444444444', 'Ivy', 'Martinez', 'ivy.martinez', 'ta'),
  ('1a002222-5555-5555-5555-555555555555', 'Jake', 'Nelson', 'jake.nelson', 'ta');

-- Week 3 - Specialization TAs (Advanced/experienced)
INSERT INTO profiles (id, first_name, last_name, alias, role) VALUES
  ('1a003333-1111-1111-1111-111111111111', 'Kara', 'Phillips', 'kara.phillips', 'ta'),
  ('1a003333-2222-2222-2222-222222222222', 'Liam', 'Rodriguez', 'liam.rodriguez', 'ta'),
  ('1a003333-3333-3333-3333-333333333333', 'Maya', 'Stewart', 'maya.stewart', 'ta'),
  ('1a003333-4444-4444-4444-444444444444', 'Noah', 'Turner', 'noah.turner', 'ta'),
  ('1a003333-5555-5555-5555-555555555555', 'Olivia', 'Walker', 'olivia.walker', 'ta');