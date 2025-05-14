-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- custom enum for chat "profiles"
CREATE TYPE chat_profile AS ENUM ('aggressive', 'shy', 'happy');

-- 1) users table
CREATE TABLE users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  username   TEXT        NOT NULL UNIQUE,
  password   TEXT        NOT NULL
);

-- 2) chats table
CREATE TABLE chats (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  title      TEXT         NOT NULL,
  completed  BOOLEAN      NOT NULL           DEFAULT FALSE,
  user_id    UUID         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  profile    chat_profile NOT NULL
);

-- 3) messages table
CREATE TABLE messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  chat_id    UUID        NOT NULL REFERENCES chats(id)  ON DELETE CASCADE,
  query      TEXT        NOT NULL,
  response   TEXT        NOT NULL,
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE
);

-- 4) rubrics table
-- (use chat's id as the primary key / foreign key)
CREATE TABLE rubrics (
  id         UUID        PRIMARY KEY REFERENCES chats(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  passed     BOOLEAN     NOT NULL,
  support    NUMERIC     NOT NULL,
  elaborated NUMERIC     NOT NULL,
  time       INTEGER     NOT NULL
);

-- Insert two users with hardcoded UUIDs
INSERT INTO users (id, username, password) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ashok', 'saravanan'),
  ('22222222-2222-2222-2222-222222222222', 'alex', 'siladie');

-- Insert a chat for each user with hardcoded UUIDs
INSERT INTO chats (id, title, user_id, profile) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ashok''s Chat', '11111111-1111-1111-1111-111111111111', 'happy'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Alex''s Chat', '22222222-2222-2222-2222-222222222222', 'aggressive');
