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


  -- Insert Test Admin User
  INSERT INTO users (id, viewed_intro, role, name, username, password, class_ids) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, 'admin', 'Test Admin', 'test_admin', 'hashed_password_admin', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, 'ta', 'Nina Park', 'nina_park', 'hashed_password_2', ARRAY['44444444-1111-1111-1111-111111111111']::UUID[]),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', false, 'ta', 'Pranav Patel', 'pranav_patel', 'hashed_password_3', ARRAY['66666666-3333-3333-3333-333333333333', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', true, 'ta', 'Richie Qian', 'richie_qian', 'hashed_password_4', ARRAY['55555555-2222-2222-2222-222222222222']::UUID[]),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, 'ta', 'Rohan Saxena', 'rohan_saxena', 'hashed_password_5', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', true, 'ta', 'Saket Shi', 'saket_shi', 'hashed_password_6', ARRAY['44444444-1111-1111-1111-111111111111', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('12345678-abcd-efab-cdef-123456789abc', false, 'ta', 'Tony Xu', 'tony_xu', 'hashed_password_7', ARRAY['55555555-2222-2222-2222-222222222222', '66666666-3333-3333-3333-333333333333']::UUID[]),
    ('87654321-dcba-fedc-baef-987654321cba', true, 'ta', 'Tayden Xiao', 'tayden_xiao', 'hashed_password_8', ARRAY['66666666-3333-3333-3333-333333333333']::UUID[]),
    ('abcdef12-3456-7890-abcd-ef1234567890', false, 'ta', 'Samarth Soe', 'samarth_soe', 'hashed_password_9', ARRAY['44444444-1111-1111-1111-111111111111', '55555555-2222-2222-2222-222222222222']::UUID[]),
    ('12ab34cd-56ef-78ab-90cd-12ef34567890', true, 'ta', 'William Yoon', 'william_yoon', 'hashed_password_10', ARRAY['77777777-4444-4444-4444-444444444444']::UUID[]),
    ('abcd1234-efab-cdef-abcd-123456abcdef', false, 'ta', 'Yuting Zhou', 'yuting_zhou', 'hashed_password_11', ARRAY['55555555-2222-2222-2222-222222222222', '77777777-4444-4444-4444-444444444444']::UUID[]),
    ('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', true, 'ta', 'Nikita Park', 'nikita_park', 'hashed_password_12', ARRAY['44444444-1111-1111-1111-111111111111', '66666666-3333-3333-3333-333333333333']::UUID[]);