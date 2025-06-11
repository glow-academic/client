-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

  CREATE TYPE user_role AS ENUM ('admin', 'instructional', 'instructor', 'ta');

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

  -- Insert Admin and Instructional Users
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, 'admin', 'Dr. Sarah Chen', 'sarah_chen', 'hashed_password_admin', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('11111111-aaaa-bbbb-cccc-111111111111', true, 'admin', 'Prof. Michael Rodriguez', 'michael_rodriguez', 'hashed_password_admin2', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]),
    ('22222222-aaaa-bbbb-cccc-222222222222', true, 'instructional', 'Dr. Emily Johnson', 'emily_johnson', 'hashed_password_inst1', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('33333333-aaaa-bbbb-cccc-333333333333', false, 'instructional', 'Prof. David Kim', 'david_kim', 'hashed_password_inst2', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
    ('44444444-aaaa-bbbb-cccc-444444444444', true, 'instructor', 'Dr. Lisa Wang', 'lisa_wang', 'hashed_password_inst3', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('55555555-aaaa-bbbb-cccc-555555555555', true, 'instructor', 'Prof. James Thompson', 'james_thompson', 'hashed_password_inst4', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

  -- Insert TAs for CS 180 (Problem Solving And Object-Oriented Programming)
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, 'ta', 'Nina Park', 'nina_park', 'hashed_password_2', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, 'ta', 'Rohan Saxena', 'rohan_saxena', 'hashed_password_5', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', true, 'ta', 'Saket Shi', 'saket_shi', 'hashed_password_6', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('abcdef12-3456-7890-abcd-ef1234567890', false, 'ta', 'Samarth Soe', 'samarth_soe', 'hashed_password_9', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', true, 'ta', 'Nikita Park', 'nikita_park', 'hashed_password_12', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('c5180001-1111-2222-3333-444444444444', false, 'ta', 'Alex Chen', 'alex_chen_180', 'hashed_password_cs180_1', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('c5180002-1111-2222-3333-444444444444', true, 'ta', 'Maya Patel', 'maya_patel_180', 'hashed_password_cs180_2', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]);

  -- Insert TAs for CS 182 (Foundations Of Computer Science)
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', true, 'ta', 'Richie Qian', 'richie_qian', 'hashed_password_4', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
    ('12345678-abcd-efab-cdef-123456789abc', false, 'ta', 'Tony Xu', 'tony_xu', 'hashed_password_7', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
    ('abcd1234-efab-cdef-abcd-123456abcdef', false, 'ta', 'Yuting Zhou', 'yuting_zhou', 'hashed_password_11', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
    ('c5182001-2222-3333-4444-555555555555', true, 'ta', 'Jordan Lee', 'jordan_lee_182', 'hashed_password_cs182_1', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
    ('c5182002-2222-3333-4444-555555555555', false, 'ta', 'Priya Sharma', 'priya_sharma_182', 'hashed_password_cs182_2', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
    ('c5182003-2222-3333-4444-555555555555', true, 'ta', 'Kevin Zhang', 'kevin_zhang_182', 'hashed_password_cs182_3', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]);

  -- Insert TAs for CS 251 (Data Structures And Algorithms)
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', false, 'ta', 'Pranav Patel', 'pranav_patel', 'hashed_password_3', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('87654321-dcba-fedc-baef-987654321cba', true, 'ta', 'Tayden Xiao', 'tayden_xiao', 'hashed_password_8', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('c5251001-3333-4444-5555-666666666666', false, 'ta', 'Sophia Martinez', 'sophia_martinez_251', 'hashed_password_cs251_1', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('c5251002-3333-4444-5555-666666666666', true, 'ta', 'Ryan O''Connor', 'ryan_oconnor_251', 'hashed_password_cs251_2', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('c5251003-3333-4444-5555-666666666666', false, 'ta', 'Aisha Johnson', 'aisha_johnson_251', 'hashed_password_cs251_3', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('c5251004-3333-4444-5555-666666666666', true, 'ta', 'Daniel Kim', 'daniel_kim_251', 'hashed_password_cs251_4', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]);

  -- Insert TAs for CS 381 (Introduction To The Analysis Of Algorithms)
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('12ab34cd-56ef-78ab-90cd-12ef34567890', true, 'ta', 'William Yoon', 'william_yoon', 'hashed_password_10', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
    ('c5381001-4444-5555-6666-777777777777', false, 'ta', 'Isabella Garcia', 'isabella_garcia_381', 'hashed_password_cs381_1', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
    ('c5381002-4444-5555-6666-777777777777', true, 'ta', 'Ethan Brown', 'ethan_brown_381', 'hashed_password_cs381_2', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
    ('c5381003-4444-5555-6666-777777777777', false, 'ta', 'Zoe Wilson', 'zoe_wilson_381', 'hashed_password_cs381_3', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
    ('c5381004-4444-5555-6666-777777777777', true, 'ta', 'Marcus Davis', 'marcus_davis_381', 'hashed_password_cs381_4', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]);

  -- Insert Multi-Class TAs (TAs who work across multiple classes)
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('c5abc001-aaaa-bbbb-cccc-dddddddddddd', true, 'ta', 'Grace Liu', 'grace_liu_multi', 'hashed_password_multi1', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
    ('c5abc002-aaaa-bbbb-cccc-dddddddddddd', false, 'ta', 'Nathan Singh', 'nathan_singh_multi', 'hashed_password_multi2', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
    ('c5abc003-aaaa-bbbb-cccc-dddddddddddd', true, 'ta', 'Emma Rodriguez', 'emma_rodriguez_multi', 'hashed_password_multi3', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('c5abc004-aaaa-bbbb-cccc-dddddddddddd', false, 'ta', 'Lucas Thompson', 'lucas_thompson_multi', 'hashed_password_multi4', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('c5abc005-aaaa-bbbb-cccc-dddddddddddd', true, 'ta', 'Chloe Anderson', 'chloe_anderson_multi', 'hashed_password_multi5', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]);


-- ===== NEW TA ACCOUNTS FOR BULK TESTING =====
INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
-- CS-180  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916601', true , 'ta', 'Harper Nguyen',    'harper_nguyen',    'hashed_pw_test1', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916602', false, 'ta', 'Diego Alvarez',    'diego_alvarez',    'hashed_pw_test2', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
-- CS-182  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916603', true , 'ta', 'Lila Banerjee',    'lila_banerjee',    'hashed_pw_test3', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916604', false, 'ta', 'Owen Foster',      'owen_foster',      'hashed_pw_test4', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
-- CS-251  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916605', true , 'ta', 'Sofia Lombardi',   'sofia_lombardi',   'hashed_pw_test5', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916606', false, 'ta', 'Noah Rasmussen',  'noah_rasmussen',   'hashed_pw_test6', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
-- CS-381  -------------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916607', true , 'ta', 'Mei Chen',         'mei_chen',         'hashed_pw_test7', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916608', false, 'ta', 'Henry Carter',     'henry_carter',     'hashed_pw_test8', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
-- multi-class ---------------------------------------------------------------
  ('99b90118-7b9e-4e12-8e81-d7ccc2916609', true , 'ta', 'Ava Petrova',      'ava_petrova',      'hashed_pw_test9',
     ARRAY['44444444-1111-1111-1111-111111111111','55555555-2222-2222-2222-222222222222']::UUID[]),
  ('99b90118-7b9e-4e12-8e81-d7ccc2916610', false, 'ta', 'Leo Müller',       'leo_muller',       'hashed_pw_test10',
     ARRAY['66666666-3333-3333-3333-333333333333','77777777-4444-4444-4444-444444444444']::UUID[]);