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
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL,
  alias      TEXT        NOT NULL,
  viewed_intro BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role       profile_role NOT NULL DEFAULT 'ta',
  class_ids  UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[]
);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Admin Users with roles and profiles
INSERT INTO users (name, email, image) VALUES
  ('Ashok Saravanan', 'redacted@purdue.edu', 'https://avatars.githubusercontent.com/u/12345?v=4'),
  ('Alex Siladie', 'redacted@purdue.edu', 'https://avatars.githubusercontent.com/u/23456?v=4'),
  ('Ethan Dickey', 'redacted@purdue.edu', 'https://avatars.githubusercontent.com/u/34567?v=4');

INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('965bd24f-dfae-4063-b370-e1373df46322', 1, 'Ashok', 'Saravanan', 'sarava18', true, 'admin', ARRAY[]::UUID[]),
  ('6a2518eb-eba7-4650-aee0-d387c3fb8265', 2, 'Alex', 'Siladie', 'asiladie', true, 'admin', ARRAY[]::UUID[]),
  ('34f445d6-7318-45a7-ba49-086b85b76b85', 3, 'Ethan', 'Dickey', 'dickeye', true, 'admin', ARRAY[]::UUID[]);

-- Insert users into the Auth.js users table with dummy images
INSERT INTO users (name, email, image) VALUES
  ('Sarah Chen', 'sarah.chen@university.edu', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150'),
  ('Michael Rodriguez', 'michael.rodriguez@university.edu', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
  ('Emily Johnson', 'emily.johnson@university.edu', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'),
  ('David Kim', 'david.kim@university.edu', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'),
  ('Lisa Wang', 'lisa.wang@university.edu', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'),
  ('James Thompson', 'james.thompson@university.edu', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'),
  ('Nina Park', 'nina.park@university.edu', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
  ('Rohan Saxena', 'rohan.saxena@university.edu', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'),
  ('Saket Shi', 'saket.shi@university.edu', 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150'),
  ('Samarth Soe', 'samarth.soe@university.edu', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'),
  ('Nikita Park', 'nikita.park@university.edu', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'),
  ('Alex Chen', 'alex.chen@university.edu', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'),
  ('Maya Patel', 'maya.patel@university.edu', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150'),
  ('Richie Qian', 'richie.qian@university.edu', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150'),
  ('Tony Xu', 'tony.xu@university.edu', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
  ('Yuting Zhou', 'yuting.zhou@university.edu', 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150'),
  ('Jordan Lee', 'jordan.lee@university.edu', 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=150'),
  ('Priya Sharma', 'priya.sharma@university.edu', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150'),
  ('Kevin Zhang', 'kevin.zhang@university.edu', 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150'),
  ('Pranav Patel', 'pranav.patel@university.edu', 'https://images.unsplash.com/photo-1522075469751-3847ae2c4c1e?w=150'),
  ('Tayden Xiao', 'tayden.xiao@university.edu', 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=150'),
  ('Sophia Martinez', 'sophia.martinez@university.edu', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150'),
  ('Ryan O''Connor', 'ryan.oconnor@university.edu', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
  ('Aisha Johnson', 'aisha.johnson@university.edu', 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?w=150'),
  ('Daniel Kim', 'daniel.kim@university.edu', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'),
  ('William Yoon', 'william.yoon@university.edu', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'),
  ('Isabella Garcia', 'isabella.garcia@university.edu', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'),
  ('Ethan Brown', 'ethan.brown@university.edu', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'),
  ('Zoe Wilson', 'zoe.wilson@university.edu', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'),
  ('Marcus Davis', 'marcus.davis@university.edu', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'),
  ('Grace Liu', 'grace.liu@university.edu', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'),
  ('Nathan Singh', 'nathan.singh@university.edu', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
  ('Emma Rodriguez', 'emma.rodriguez@university.edu', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
  ('Lucas Thompson', 'lucas.thompson@university.edu', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'),
  ('Chloe Anderson', 'chloe.anderson@university.edu', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150'),
  ('Harper Nguyen', 'harper.nguyen@university.edu', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150'),
  ('Diego Alvarez', 'diego.alvarez@university.edu', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150'),
  ('Lila Banerjee', 'lila.banerjee@university.edu', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150'),
  ('Owen Foster', 'owen.foster@university.edu', 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150'),
  ('Sofia Lombardi', 'sofia.lombardi@university.edu', 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?w=150'),
  ('Noah Rasmussen', 'noah.rasmussen@university.edu', 'https://images.unsplash.com/photo-1522075469751-3847ae2c4c1e?w=150'),
  ('John Doe', 'john.doe@university.edu', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'),
  ('Henry Carter', 'henry.carter@university.edu', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'),
  ('Ava Petrova', 'ava.petrova@university.edu', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'),
  ('Leo Müller', 'leo.muller@university.edu', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150');

-- Then, insert profiles linked to the users
-- Admin and Instructional Users
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4, 'Sarah', 'Chen', 'sarah.chen', true, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('11111111-aaaa-bbbb-cccc-111111111111', 5, 'Michael', 'Rodriguez', 'michael.rodriguez', true, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('22222222-aaaa-bbbb-cccc-222222222222', 6, 'Emily', 'Johnson', 'emily.johnson', true, 'instructional', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('33333333-aaaa-bbbb-cccc-333333333333', 7, 'David', 'Kim', 'david.kim', false, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('44444444-aaaa-bbbb-cccc-444444444444', 8, 'Lisa', 'Wang', 'lisa.wang', true, 'instructor', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('55555555-aaaa-bbbb-cccc-555555555555', 9, 'James', 'Thompson', 'james.thompson', true, 'instructor', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- TAs for CS 180 (Problem Solving And Object-Oriented Programming)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 10, 'Nina', 'Park', 'nina.park', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 11, 'Rohan', 'Saxena', 'rohan.saxena', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 12, 'Saket', 'Shi', 'saket.shi', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('abcdef12-3456-7890-abcd-ef1234567890', 13, 'Samarth', 'Soe', 'samarth.soe', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 14, 'Nikita', 'Park', 'nikita.park', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180001-1111-2222-3333-444444444444', 15, 'Alex', 'Chen', 'alex.chen', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180002-1111-2222-3333-444444444444', 16, 'Maya', 'Patel', 'maya.patel', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]);

-- TAs for CS 182 (Foundations Of Computer Science)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 17, 'Richie', 'Qian', 'richie.qian', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('12345678-abcd-efab-cdef-123456789abc', 18, 'Tony', 'Xu', 'tony.xu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('abcd1234-efab-cdef-abcd-123456abcdef', 19, 'Yuting', 'Zhou', 'yuting.zhou', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182001-2222-3333-4444-555555555555', 20, 'Jordan', 'Lee', 'jordan.lee', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182002-2222-3333-4444-555555555555', 21, 'Priya', 'Sharma', 'priya.sharma', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182003-2222-3333-4444-555555555555', 22, 'Kevin', 'Zhang', 'kevin.zhang', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]);

-- TAs for CS 251 (Data Structures And Algorithms)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 23, 'Pranav', 'Patel', 'pranav.patel', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('87654321-dcba-fedc-baef-987654321cba', 24, 'Tayden', 'Xiao', 'tayden.xiao', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251001-3333-4444-5555-666666666666', 25, 'Sophia', 'Martinez', 'sophia.martinez', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251002-3333-4444-5555-666666666666', 26, 'Ryan', 'O''Connor', 'ryan.oconnor', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251003-3333-4444-5555-666666666666', 27, 'Aisha', 'Johnson', 'aisha.johnson', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251004-3333-4444-5555-666666666666', 28, 'Daniel', 'Kim', 'daniel.kim', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]);

-- TAs for CS 381 (Introduction To The Analysis Of Algorithms)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('12ab34cd-56ef-78ab-90cd-12ef34567890', 29, 'William', 'Yoon', 'william.yoon', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381001-4444-5555-6666-777777777777', 30, 'Isabella', 'Garcia', 'isabella.garcia', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381002-4444-5555-6666-777777777777', 31, 'Ethan', 'Brown', 'ethan.brown', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381003-4444-5555-6666-777777777777', 32, 'Zoe', 'Wilson', 'zoe.wilson', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381004-4444-5555-6666-777777777777', 33, 'Marcus', 'Davis', 'marcus.davis', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- Multi-Class TAs (TAs who work across multiple classes)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('c5abc001-aaaa-bbbb-cccc-dddddddddddd', 34, 'Grace', 'Liu', 'grace.liu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5abc002-aaaa-bbbb-cccc-dddddddddddd', 35, 'Nathan', 'Singh', 'nathan.singh', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5abc003-aaaa-bbbb-cccc-dddddddddddd', 36, 'Emma', 'Rodriguez', 'emma.rodriguez', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc004-aaaa-bbbb-cccc-dddddddddddd', 37, 'Lucas', 'Thompson', 'lucas.thompson', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc005-aaaa-bbbb-cccc-dddddddddddd', 38, 'Chloe', 'Anderson', 'chloe.anderson', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]);

-- NEW TA ACCOUNTS FOR BULK TESTING
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
-- CS-180  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916601', 39, 'Harper', 'Nguyen', 'harper.nguyen', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916602', 40, 'Diego', 'Alvarez', 'diego.alvarez', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
-- CS-182  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916603', 41, 'Lila', 'Banerjee', 'lila.banerjee', true , 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916604', 42, 'Owen', 'Foster', 'owen.foster', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
-- CS-251  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916605', 43, 'Sofia', 'Lombardi', 'sofia.lombardi', true , 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916606', 44, 'Noah', 'Rasmussen', 'noah.rasmussen', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
-- CS-381  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916607', 45, 'John', 'Doe', 'john.doe', true , 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916608', 46, 'Henry', 'Carter', 'henry.carter', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
-- multi-class ---------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916609', 47, 'Ava', 'Petrova', 'ava.petrova', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111','55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916610', 48, 'Leo', 'Müller', 'leo.muller', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333','77777777-4444-4444-4444-444444444444']::UUID[]);