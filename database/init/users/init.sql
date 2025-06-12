-- For Auth.js - Updated to match NextAuth Drizzle adapter requirements
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE users (
  id         UUID        PRIMARY KEY,
  email      TEXT        NOT NULL
);

CREATE TYPE profile_role AS ENUM ('admin', 'instructional', 'instructor', 'ta');

CREATE TABLE profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Cutstom Users with roles, and admin profiles
INSERT INTO users (id, email) VALUES
  ('ac2da0fb-385d-487e-9fa1-c5010d7c18e0', 'redacted@purdue.edu'),
  ('12471175-62bf-4308-9bd8-4b3e61af798c', 'redacted@purdue.edu'),
  ('a8e0377a-3328-4ec6-bcc9-411b96f14243', 'redacted@purdue.edu');

INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('965bd24f-dfae-4063-b370-e1373df46322', 'ac2da0fb-385d-487e-9fa1-c5010d7c18e0', 'Ashok', 'Saravanan', 'sarava18', true, 'admin', ARRAY[]::UUID[]),
  ('6a2518eb-eba7-4650-aee0-d387c3fb8265', '12471175-62bf-4308-9bd8-4b3e61af798c', 'Alex', 'Siladie', 'asiladie', true, 'admin', ARRAY[]::UUID[]),
  ('34f445d6-7318-45a7-ba49-086b85b76b85', 'a8e0377a-3328-4ec6-bcc9-411b96f14243', 'Ethan', 'Dickey', 'dickeye', true, 'instructional', ARRAY[]::UUID[]);

-- First, insert users into the Auth.js users table with UUID IDs
INSERT INTO users (id, email) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'sarah.chen@university.edu'),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'michael.rodriguez@university.edu'),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'emily.johnson@university.edu'),
  ('d4e5f6a7-b8c9-0123-def4-56789012345a', 'david.kim@university.edu'),
  ('e5f6a7b8-c9d0-1234-ef56-789012345abc', 'lisa.wang@university.edu'),
  ('f6a7b8c9-d0e1-2345-f678-90123456abcd', 'james.thompson@university.edu'),
  ('a7b8c9d0-e1f2-3456-789a-bcdef0123456', 'nina.park@university.edu'),
  ('b8c9d0e1-f2a3-4567-89ab-cdef01234567', 'rohan.saxena@university.edu'),
  ('c9d0e1f2-a3b4-5678-9abc-def012345678', 'saket.shi@university.edu'),
  ('d0e1f2a3-b4c5-6789-abcd-ef0123456789', 'samarth.soe@university.edu'),
  ('e1f2a3b4-c5d6-789a-bcde-f01234567890', 'nikita.park@university.edu'),
  ('f2a3b4c5-d6e7-89ab-cdef-012345678901', 'alex.chen@university.edu'),
  ('a3b4c5d6-e7f8-9abc-def0-123456789012', 'maya.patel@university.edu'),
  ('b4c5d6e7-f8a9-abcd-ef01-23456789abcd', 'richie.qian@university.edu'),
  ('c5d6e7f8-a9b0-bcde-f012-3456789abcde', 'tony.xu@university.edu'),
  ('d6e7f8a9-b0c1-cdef-0123-456789abcdef', 'yuting.zhou@university.edu'),
  ('e7f8a9b0-c1d2-def0-1234-56789abcdef0', 'jordan.lee@university.edu'),
  ('f8a9b0c1-d2e3-ef01-2345-6789abcdef01', 'priya.sharma@university.edu'),
  ('a9b0c1d2-e3f4-f012-3456-789abcdef012', 'kevin.zhang@university.edu'),
  ('b0c1d2e3-f4a5-0123-4567-89abcdef0123', 'pranav.patel@university.edu'),
  ('c1d2e3f4-a5b6-1234-5678-9abcdef01234', 'tayden.xiao@university.edu'),
  ('d2e3f4a5-b6c7-2345-6789-abcdef012345', 'sophia.martinez@university.edu'),
  ('e3f4a5b6-c7d8-3456-789a-bcdef0123456', 'ryan.oconnor@university.edu'),
  ('f4a5b6c7-d8e9-4567-89ab-cdef01234567', 'aisha.johnson@university.edu'),
  ('a5b6c7d8-e9f0-5678-9abc-def012345678', 'daniel.kim@university.edu'),
  ('b6c7d8e9-f0a1-6789-abcd-ef0123456789', 'william.yoon@university.edu'),
  ('c7d8e9f0-a1b2-789a-bcde-f01234567890', 'isabella.garcia@university.edu'),
  ('d8e9f0a1-b2c3-89ab-cdef-012345678901', 'ethan.brown@university.edu'),
  ('e9f0a1b2-c3d4-9abc-def0-123456789012', 'zoe.wilson@university.edu'),
  ('f0a1b2c3-d4e5-abcd-ef01-23456789abcd', 'marcus.davis@university.edu'),
  ('a1b2c3d4-e5f6-bcde-f012-3456789abcde', 'grace.liu@university.edu'),
  ('b2c3d4e5-f6a7-cdef-0123-456789abcdef', 'nathan.singh@university.edu'),
  ('c3d4e5f6-a7b8-def0-1234-56789abcdef0', 'emma.rodriguez@university.edu'),
  ('d4e5f6a7-b8c9-ef01-2345-6789abcdef01', 'lucas.thompson@university.edu'),
  ('e5f6a7b8-c9d0-f012-3456-789abcdef012', 'chloe.anderson@university.edu'),
  ('f6a7b8c9-d0e1-0123-4567-89abcdef0123', 'harper.nguyen@university.edu'),
  ('a7b8c9d0-e1f2-1234-5678-9abcdef01234', 'diego.alvarez@university.edu'),
  ('b8c9d0e1-f2a3-2345-6789-abcdef012345', 'lila.banerjee@university.edu'),
  ('c9d0e1f2-a3b4-3456-789a-bcdef0123456', 'owen.foster@university.edu'),
  ('d0e1f2a3-b4c5-4567-89ab-cdef01234567', 'sofia.lombardi@university.edu'),
  ('e1f2a3b4-c5d6-5678-9abc-def012345678', 'noah.rasmussen@university.edu'),
  ('f2a3b4c5-d6e7-6789-abcd-ef0123456789', 'john.doe@university.edu'),
  ('a3b4c5d6-e7f8-789a-bcde-f01234567890', 'henry.carter@university.edu'),
  ('b4c5d6e7-f8a9-89ab-cdef-012345678901', 'ava.petrova@university.edu'),
  ('c5d6e7f8-a9b0-9abc-def0-123456789012', 'leo.muller@university.edu');

-- Then, insert profiles linked to the users
-- Admin and Instructional Users
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sarah', 'Chen', 'sarah.chen', true, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('11111111-aaaa-bbbb-cccc-111111111111', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Michael', 'Rodriguez', 'michael.rodriguez', true, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('22222222-aaaa-bbbb-cccc-222222222222', 'c3d4e5f6-a7b8-9012-cdef-345678901234', 'Emily', 'Johnson', 'emily.johnson', true, 'instructional', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('33333333-aaaa-bbbb-cccc-333333333333', 'd4e5f6a7-b8c9-0123-def4-56789012345a', 'David', 'Kim', 'david.kim', false, 'instructional', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('44444444-aaaa-bbbb-cccc-444444444444', 'e5f6a7b8-c9d0-1234-ef56-789012345abc', 'Lisa', 'Wang', 'lisa.wang', true, 'instructor', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('55555555-aaaa-bbbb-cccc-555555555555', 'f6a7b8c9-d0e1-2345-f678-90123456abcd', 'James', 'Thompson', 'james.thompson', true, 'instructor', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- TAs for CS 180 (Problem Solving And Object-Oriented Programming)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a7b8c9d0-e1f2-3456-789a-bcdef0123456', 'Nina', 'Park', 'nina.park', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'b8c9d0e1-f2a3-4567-89ab-cdef01234567', 'Rohan', 'Saxena', 'rohan.saxena', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'c9d0e1f2-a3b4-5678-9abc-def012345678', 'Saket', 'Shi', 'saket.shi', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('abcdef12-3456-7890-abcd-ef1234567890', 'd0e1f2a3-b4c5-6789-abcd-ef0123456789', 'Samarth', 'Soe', 'samarth.soe', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', 'e1f2a3b4-c5d6-789a-bcde-f01234567890', 'Nikita', 'Park', 'nikita.park', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180001-1111-2222-3333-444444444444', 'f2a3b4c5-d6e7-89ab-cdef-012345678901', 'Alex', 'Chen', 'alex.chen', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('c5180002-1111-2222-3333-444444444444', 'a3b4c5d6-e7f8-9abc-def0-123456789012', 'Maya', 'Patel', 'maya.patel', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]);

-- TAs for CS 182 (Foundations Of Computer Science)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'b4c5d6e7-f8a9-abcd-ef01-23456789abcd', 'Richie', 'Qian', 'richie.qian', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('12345678-abcd-efab-cdef-123456789abc', 'c5d6e7f8-a9b0-bcde-f012-3456789abcde', 'Tony', 'Xu', 'tony.xu', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('abcd1234-efab-cdef-abcd-123456abcdef', 'd6e7f8a9-b0c1-cdef-0123-456789abcdef', 'Yuting', 'Zhou', 'yuting.zhou', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182001-2222-3333-4444-555555555555', 'e7f8a9b0-c1d2-def0-1234-56789abcdef0', 'Jordan', 'Lee', 'jordan.lee', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182002-2222-3333-4444-555555555555', 'f8a9b0c1-d2e3-ef01-2345-6789abcdef01', 'Priya', 'Sharma', 'priya.sharma', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5182003-2222-3333-4444-555555555555', 'a9b0c1d2-e3f4-f012-3456-789abcdef012', 'Kevin', 'Zhang', 'kevin.zhang', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]);

-- TAs for CS 251 (Data Structures And Algorithms)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'b0c1d2e3-f4a5-0123-4567-89abcdef0123', 'Pranav', 'Patel', 'pranav.patel', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('87654321-dcba-fedc-baef-987654321cba', 'c1d2e3f4-a5b6-1234-5678-9abcdef01234', 'Tayden', 'Xiao', 'tayden.xiao', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251001-3333-4444-5555-666666666666', 'd2e3f4a5-b6c7-2345-6789-abcdef012345', 'Sophia', 'Martinez', 'sophia.martinez', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251002-3333-4444-5555-666666666666', 'e3f4a5b6-c7d8-3456-789a-bcdef0123456', 'Ryan', 'O''Connor', 'ryan.oconnor', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251003-3333-4444-5555-666666666666', 'f4a5b6c7-d8e9-4567-89ab-cdef01234567', 'Aisha', 'Johnson', 'aisha.johnson', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5251004-3333-4444-5555-666666666666', 'a5b6c7d8-e9f0-5678-9abc-def012345678', 'Daniel', 'Kim', 'daniel.kim', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]);

-- TAs for CS 381 (Introduction To The Analysis Of Algorithms)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('12ab34cd-56ef-78ab-90cd-12ef34567890', 'b6c7d8e9-f0a1-6789-abcd-ef0123456789', 'William', 'Yoon', 'william.yoon', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381001-4444-5555-6666-777777777777', 'c7d8e9f0-a1b2-789a-bcde-f01234567890', 'Isabella', 'Garcia', 'isabella.garcia', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381002-4444-5555-6666-777777777777', 'd8e9f0a1-b2c3-89ab-cdef-012345678901', 'Ethan', 'Brown', 'ethan.brown', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381003-4444-5555-6666-777777777777', 'e9f0a1b2-c3d4-9abc-def0-123456789012', 'Zoe', 'Wilson', 'zoe.wilson', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5381004-4444-5555-6666-777777777777', 'f0a1b2c3-d4e5-abcd-ef01-23456789abcd', 'Marcus', 'Davis', 'marcus.davis', true, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

-- Multi-Class TAs (TAs who work across multiple classes)
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
  ('c5abc001-aaaa-bbbb-cccc-dddddddddddd', 'a1b2c3d4-e5f6-bcde-f012-3456789abcde', 'Grace', 'Liu', 'grace.liu', true, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
  ('c5abc002-aaaa-bbbb-cccc-dddddddddddd', 'b2c3d4e5-f6a7-cdef-0123-456789abcdef', 'Nathan', 'Singh', 'nathan.singh', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
  ('c5abc003-aaaa-bbbb-cccc-dddddddddddd', 'c3d4e5f6-a7b8-def0-1234-56789abcdef0', 'Emma', 'Rodriguez', 'emma.rodriguez', true, 'ta', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc004-aaaa-bbbb-cccc-dddddddddddd', 'd4e5f6a7-b8c9-ef01-2345-6789abcdef01', 'Lucas', 'Thompson', 'lucas.thompson', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
  ('c5abc005-aaaa-bbbb-cccc-dddddddddddd', 'e5f6a7b8-c9d0-f012-3456-789abcdef012', 'Chloe', 'Anderson', 'chloe.anderson', true, 'ta', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]);

-- NEW TA ACCOUNTS FOR BULK TESTING
INSERT INTO profiles (id, user_id, first_name, last_name, alias, viewed_intro, role, class_ids) VALUES
-- CS-180  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916601', 'f6a7b8c9-d0e1-0123-4567-89abcdef0123', 'Harper', 'Nguyen', 'harper.nguyen', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916602', 'a7b8c9d0-e1f2-1234-5678-9abcdef01234', 'Diego', 'Alvarez', 'diego.alvarez', false, 'ta', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
-- CS-182  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916603', 'b8c9d0e1-f2a3-2345-6789-abcdef012345', 'Lila', 'Banerjee', 'lila.banerjee', true , 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916604', 'c9d0e1f2-a3b4-3456-789a-bcdef0123456', 'Owen', 'Foster', 'owen.foster', false, 'ta', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
-- CS-251  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916605', 'd0e1f2a3-b4c5-4567-89ab-cdef01234567', 'Sofia', 'Lombardi', 'sofia.lombardi', true , 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916606', 'e1f2a3b4-c5d6-5678-9abc-def012345678', 'Noah', 'Rasmussen', 'noah.rasmussen', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
-- CS-381  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916607', 'f2a3b4c5-d6e7-6789-abcd-ef0123456789', 'John', 'Doe', 'john.doe', true , 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916608', 'a3b4c5d6-e7f8-789a-bcde-f01234567890', 'Henry', 'Carter', 'henry.carter', false, 'ta', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
-- multi-class ---------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916609', 'b4c5d6e7-f8a9-89ab-cdef-012345678901', 'Ava', 'Petrova', 'ava.petrova', true , 'ta', ARRAY['44444444-1111-1111-1111-111111111111','55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916610', 'c5d6e7f8-a9b0-9abc-def0-123456789012', 'Leo', 'Müller', 'leo.muller', false, 'ta', ARRAY['66666666-3333-3333-3333-333333333333','77777777-4444-4444-4444-444444444444']::UUID[]);