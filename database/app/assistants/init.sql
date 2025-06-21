-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE assistant_message_type AS ENUM ('user', 'assistant'); -- user or assistant
CREATE TYPE assistant_tool_type AS ENUM ('create', 'read', 'update', 'delete'); -- create, read, update, delete

CREATE TABLE assistant_chats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  profile_id UUID        NOT NULL REFERENCES profiles(id),
  trace_id   TEXT         NULL -- openai trace id
);

CREATE TABLE assistant_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(), 
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  completed_at TIMESTAMPTZ  NULL,
  chat_id    UUID        NOT NULL REFERENCES assistant_chats(id),
  role       assistant_message_type NOT NULL,
  content    TEXT        NOT NULL,
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE
);

CREATE TABLE assistant_tool_calls (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  completed_at TIMESTAMPTZ  NULL,
  chat_id    UUID        NOT NULL REFERENCES assistant_chats(id),
  message_id UUID        NOT NULL REFERENCES assistant_messages(id),
  tool_name  TEXT        NOT NULL,
  tool_type  assistant_tool_type NOT NULL,
  tool_arguments JSONB        NOT NULL,
  tool_result JSONB        NOT NULL,
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE
);