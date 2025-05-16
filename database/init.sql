-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- custom enum for chat "profiles"
CREATE TYPE chat_profile AS ENUM ('aggressive', 'happy', 'confused');

-- 1) users table
CREATE TABLE users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viewed_intro BOOLEAN     NOT NULL           DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  admin      BOOLEAN     NOT NULL           DEFAULT FALSE,
  username   TEXT        NOT NULL UNIQUE,
  password   TEXT        NOT NULL
);

-- 2) chats table
CREATE TABLE chats (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  completed_at TIMESTAMPTZ  NULL,
  title      TEXT         NOT NULL,
  scenario_description TEXT         NOT NULL,
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
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID        NOT NULL REFERENCES chats(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  passed     BOOLEAN     NOT NULL,
  score      INTEGER     NOT NULL,
  time_taken INTEGER     NOT NULL,
  adaptability INTEGER     NOT NULL, -- 0-5
  adaptability_feedback TEXT,
  listening INTEGER     NOT NULL, -- 0-5
  listening_feedback TEXT,
  objectives INTEGER     NOT NULL, -- 0-5
  objectives_feedback TEXT,
  time_management INTEGER     NOT NULL, -- 0-5
  time_management_feedback TEXT
);

-- 5) documents table - for reference materials
CREATE TABLE documents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  file_path  TEXT        NOT NULL, -- Path to file in the filesystem
  mime_type  TEXT        NOT NULL,
  profile    chat_profile NOT NULL -- Associated profile type
);
