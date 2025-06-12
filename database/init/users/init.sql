-- For Auth.js - Updated to match NextAuth Drizzle adapter requirements
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE verification_token
(
  identifier TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL,
 
  PRIMARY KEY (identifier, token)
);
 
CREATE TABLE accounts
(
  "userId" TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  id_token TEXT,
  scope TEXT,
  session_state TEXT,
  token_type TEXT,
 
  PRIMARY KEY (provider, "providerAccountId")
);
 
CREATE TABLE sessions
(
  "sessionToken" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL
);
 
CREATE TABLE users
(
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT
);

-- Add foreign key constraints for Auth.js tables
ALTER TABLE accounts ADD CONSTRAINT accounts_userId_fkey 
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE sessions ADD CONSTRAINT sessions_userId_fkey 
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE profile_role AS ENUM ('admin', 'instructional', 'instructor', 'ta');

CREATE TABLE profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name  VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  viewed_intro BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role       profile_role NOT NULL DEFAULT 'ta',
  class_ids  UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[]
);

-- Create index for better performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- First, insert users into the Auth.js users table with simple text IDs
INSERT INTO users (id, name, email) VALUES
  ('user_sarah_chen', 'Dr. Sarah Chen', 'sarah.chen@university.edu'),
  ('user_michael_rodriguez', 'Prof. Michael Rodriguez', 'michael.rodriguez@university.edu'),
  ('user_emily_johnson', 'Dr. Emily Johnson', 'emily.johnson@university.edu'),
  ('user_david_kim', 'Prof. David Kim', 'david.kim@university.edu'),
  ('user_lisa_wang', 'Dr. Lisa Wang', 'lisa.wang@university.edu'),
  ('user_james_thompson', 'Prof. James Thompson', 'james.thompson@university.edu'),
  ('user_nina_park', 'Nina Park', 'nina.park@university.edu'),
  ('user_rohan_saxena', 'Rohan Saxena', 'rohan.saxena@university.edu'),
  ('user_saket_shi', 'Saket Shi', 'saket.shi@university.edu'),
  ('user_samarth_soe', 'Samarth Soe', 'samarth.soe@university.edu'),
  ('user_nikita_park', 'Nikita Park', 'nikita.park@university.edu'),
  ('user_alex_chen', 'Alex Chen', 'alex.chen@university.edu'),
  ('user_maya_patel', 'Maya Patel', 'maya.patel@university.edu'),
  ('user_richie_qian', 'Richie Qian', 'richie.qian@university.edu'),
  ('user_tony_xu', 'Tony Xu', 'tony.xu@university.edu'),
  ('user_yuting_zhou', 'Yuting Zhou', 'yuting.zhou@university.edu'),
  ('user_jordan_lee', 'Jordan Lee', 'jordan.lee@university.edu'),
  ('user_priya_sharma', 'Priya Sharma', 'priya.sharma@university.edu'),
  ('user_kevin_zhang', 'Kevin Zhang', 'kevin.zhang@university.edu'),
  ('user_pranav_patel', 'Pranav Patel', 'pranav.patel@university.edu'),
  ('user_tayden_xiao', 'Tayden Xiao', 'tayden.xiao@university.edu'),
  ('user_sophia_martinez', 'Sophia Martinez', 'sophia.martinez@university.edu'),
  ('user_ryan_oconnor', 'Ryan O''Connor', 'ryan.oconnor@university.edu'),
  ('user_aisha_johnson', 'Aisha Johnson', 'aisha.johnson@university.edu'),
  ('user_daniel_kim', 'Daniel Kim', 'daniel.kim@university.edu'),
  ('user_william_yoon', 'William Yoon', 'william.yoon@university.edu'),
  ('user_isabella_garcia', 'Isabella Garcia', 'isabella.garcia@university.edu'),
  ('user_ethan_brown', 'Ethan Brown', 'ethan.brown@university.edu'),
  ('user_zoe_wilson', 'Zoe Wilson', 'zoe.wilson@university.edu'),
  ('user_marcus_davis', 'Marcus Davis', 'marcus.davis@university.edu'),
  ('user_grace_liu', 'Grace Liu', 'grace.liu@university.edu'),
  ('user_nathan_singh', 'Nathan Singh', 'nathan.singh@university.edu'),
  ('user_emma_rodriguez', 'Emma Rodriguez', 'emma.rodriguez@university.edu'),
  ('user_lucas_thompson', 'Lucas Thompson', 'lucas.thompson@university.edu'),
  ('user_chloe_anderson', 'Chloe Anderson', 'chloe.anderson@university.edu'),
  ('user_harper_nguyen', 'Harper Nguyen', 'harper.nguyen@university.edu'),
  ('user_diego_alvarez', 'Diego Alvarez', 'diego.alvarez@university.edu'),
  ('user_lila_banerjee', 'Lila Banerjee', 'lila.banerjee@university.edu'),
  ('user_owen_foster', 'Owen Foster', 'owen.foster@university.edu'),
  ('user_sofia_lombardi', 'Sofia Lombardi', 'sofia.lombardi@university.edu'),
  ('user_noah_rasmussen', 'Noah Rasmussen', 'noah.rasmussen@university.edu'),
  ('user_ethan_dickey', 'Ethan Dickey', 'ethan.dickey@university.edu'),
  ('user_henry_carter', 'Henry Carter', 'henry.carter@university.edu'),
  ('user_ava_petrova', 'Ava Petrova', 'ava.petrova@university.edu'),
  ('user_leo_muller', 'Leo Müller', 'leo.muller@university.edu');

-- Then, insert profiles linked to the users
-- Admin and Instructional Users
INSERT INTO profiles (id, user_id, first_name, last_name, email, viewed_intro, role, class_ids) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user_sarah_chen', 'Sarah', 'Chen', 'sarah.chen@university.edu', true, 'admin', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('11111111-aaaa-bbbb-cccc-111111111111', 'user_michael_rodriguez', 'Michael', 'Rodriguez', 'michael.rodriguez@university.edu', true, 'admin', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('22222222-aaaa-bbbb-cccc-222222222222', 'user_emily_johnson', 'Emily', 'Johnson', 'emily.johnson@university.edu', true, 'instructional', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('33333333-aaaa-bbbb-cccc-333333333333', 'user_david_kim', 'David', 'Kim', 'david.kim@university.edu', false, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('44444444-aaaa-bbbb-cccc-444444444444', 'user_lisa_wang', 'Lisa', 'Wang', 'lisa.wang@university.edu', true, 'instructor', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('55555555-aaaa-bbbb-cccc-555555555555', 'user_james_thompson', 'James', 'Thompson', 'james.thompson@university.edu', true, 'instructor', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- TAs for CS 180 (Problem Solving And Object-Oriented Programming)
INSERT INTO profiles (id, user_id, first_name, last_name, email, viewed_intro, role, class_ids) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user_nina_park', 'Nina', 'Park', 'nina.park@university.edu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'user_rohan_saxena', 'Rohan', 'Saxena', 'rohan.saxena@university.edu', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'user_saket_shi', 'Saket', 'Shi', 'saket.shi@university.edu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('abcdef12-3456-7890-abcd-ef1234567890', 'user_samarth_soe', 'Samarth', 'Soe', 'samarth.soe@university.edu', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'user_nikita_park', 'Nikita', 'Park', 'nikita.park@university.edu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180001-1111-2222-3333-444444444444', 'user_alex_chen', 'Alex', 'Chen', 'alex.chen@university.edu', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180002-1111-2222-3333-444444444444', 'user_maya_patel', 'Maya', 'Patel', 'maya.patel@university.edu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]);

-- TAs for CS 182 (Foundations Of Computer Science)
INSERT INTO profiles (id, user_id, first_name, last_name, email, viewed_intro, role, class_ids) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'user_richie_qian', 'Richie', 'Qian', 'richie.qian@university.edu', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('12345678-abcd-efab-cdef-123456789abc', 'user_tony_xu', 'Tony', 'Xu', 'tony.xu@university.edu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('abcd1234-efab-cdef-abcd-123456abcdef', 'user_yuting_zhou', 'Yuting', 'Zhou', 'yuting.zhou@university.edu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182001-2222-3333-4444-555555555555', 'user_jordan_lee', 'Jordan', 'Lee', 'jordan.lee@university.edu', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182002-2222-3333-4444-555555555555', 'user_priya_sharma', 'Priya', 'Sharma', 'priya.sharma@university.edu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182003-2222-3333-4444-555555555555', 'user_kevin_zhang', 'Kevin', 'Zhang', 'kevin.zhang@university.edu', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]);

-- TAs for CS 251 (Data Structures And Algorithms)
INSERT INTO profiles (id, user_id, first_name, last_name, email, viewed_intro, role, class_ids) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'user_pranav_patel', 'Pranav', 'Patel', 'pranav.patel@university.edu', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('87654321-dcba-fedc-baef-987654321cba', 'user_tayden_xiao', 'Tayden', 'Xiao', 'tayden.xiao@university.edu', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251001-3333-4444-5555-666666666666', 'user_sophia_martinez', 'Sophia', 'Martinez', 'sophia.martinez@university.edu', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251002-3333-4444-5555-666666666666', 'user_ryan_oconnor', 'Ryan', 'O''Connor', 'ryan.oconnor@university.edu', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251003-3333-4444-5555-666666666666', 'user_aisha_johnson', 'Aisha', 'Johnson', 'aisha.johnson@university.edu', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251004-3333-4444-5555-666666666666', 'user_daniel_kim', 'Daniel', 'Kim', 'daniel.kim@university.edu', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]);

-- TAs for CS 381 (Introduction To The Analysis Of Algorithms)
INSERT INTO profiles (id, user_id, first_name, last_name, email, viewed_intro, role, class_ids) VALUES
  ('12ab34cd-56ef-78ab-90cd-12ef34567890', 'user_william_yoon', 'William', 'Yoon', 'william.yoon@university.edu', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381001-4444-5555-6666-777777777777', 'user_isabella_garcia', 'Isabella', 'Garcia', 'isabella.garcia@university.edu', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381002-4444-5555-6666-777777777777', 'user_ethan_brown', 'Ethan', 'Brown', 'ethan.brown@university.edu', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381003-4444-5555-6666-777777777777', 'user_zoe_wilson', 'Zoe', 'Wilson', 'zoe.wilson@university.edu', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381004-4444-5555-6666-777777777777', 'user_marcus_davis', 'Marcus', 'Davis', 'marcus.davis@university.edu', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- Multi-Class TAs (TAs who work across multiple classes)
INSERT INTO profiles (id, user_id, first_name, last_name, email, viewed_intro, role, class_ids) VALUES
  ('c5abc001-aaaa-bbbb-cccc-dddddddddddd', 'user_grace_liu', 'Grace', 'Liu', 'grace.liu@university.edu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5abc002-aaaa-bbbb-cccc-dddddddddddd', 'user_nathan_singh', 'Nathan', 'Singh', 'nathan.singh@university.edu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'user_emma_rodriguez', 'Emma', 'Rodriguez', 'emma.rodriguez@university.edu', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc004-aaaa-bbbb-cccc-dddddddddddd', 'user_lucas_thompson', 'Lucas', 'Thompson', 'lucas.thompson@university.edu', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc005-aaaa-bbbb-cccc-dddddddddddd', 'user_chloe_anderson', 'Chloe', 'Anderson', 'chloe.anderson@university.edu', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]);

-- NEW TA ACCOUNTS FOR BULK TESTING
INSERT INTO profiles (id, user_id, first_name, last_name, email, viewed_intro, role, class_ids) VALUES
-- CS-180  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916601', 'user_harper_nguyen', 'Harper', 'Nguyen', 'harper.nguyen@university.edu', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916602', 'user_diego_alvarez', 'Diego', 'Alvarez', 'diego.alvarez@university.edu', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
-- CS-182  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916603', 'user_lila_banerjee', 'Lila', 'Banerjee', 'lila.banerjee@university.edu', true , 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916604', 'user_owen_foster', 'Owen', 'Foster', 'owen.foster@university.edu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
-- CS-251  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916605', 'user_sofia_lombardi', 'Sofia', 'Lombardi', 'sofia.lombardi@university.edu', true , 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916606', 'user_noah_rasmussen', 'Noah', 'Rasmussen', 'noah.rasmussen@university.edu', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
-- CS-381  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916607', 'user_ethan_dickey', 'Ethan', 'Dickey', 'ethan.dickey@university.edu', true , 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916608', 'user_henry_carter', 'Henry', 'Carter', 'henry.carter@university.edu', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
-- multi-class ---------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916609', 'user_ava_petrova', 'Ava', 'Petrova', 'ava.petrova@university.edu', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111','55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916610', 'user_leo_muller', 'Leo', 'Müller', 'leo.muller@university.edu', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333','77777777-4444-4444-4444-444444444444']::UUID[]);