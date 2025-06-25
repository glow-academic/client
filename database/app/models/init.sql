-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE providers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  api_key TEXT        NOT NULL -- This will be encrypted when stored in the database
);

CREATE TABLE models (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  provider_id UUID        NOT NULL,
  active      BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Insert providers with properly encrypted API keys
INSERT INTO providers (id, name, description, api_key) VALUES 
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'wGLPJELBu7wjOSYceQ/xdUQNCNbrenUi04+VE7+4QJxJgQjf/njuBD/wEtCygcSdvDvlAhwdb8E4B4UuhlCKsO2Pcr/nR6ooVfMmU3v3I+fX34zCp9WvFLZHFlxXfpX5jsiJCQBcsKX2JmUSJ4fqIcJx6zObzGIMoGrznuqb3xMp9G27I9poiwoi+HYpYmKyrDPUL5eYeEwp1ZIy/GLIr/7jHQaa+0UYjSNDtEfIs6cdixEsr5BKPgEOYDiYo/VQFg9SoXs5rSq3ALjOpUEZtH6UcY5SeQjOQGVkn6MrG2M='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'b84zMCijGe0uhHx32IYNotZDcgB29OqA3AE3ZKRuVsilHBaWKMPNeJaLJWXcuSwj+UQlkPZfUdS5rqDa7OU1EA33Ol8XPjXZt6dyc2S9bqBQ0xR7fd69xok7IXp5pwOz');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
