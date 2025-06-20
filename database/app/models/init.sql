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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'GFYAw6+3B4dWZ6/Zed0Z5cX2xBXjbZFh/c2ePG2QV8KB1koDfDGObr3wWyai7gP5x7yfyUbVGyfNwzJ9JqpnMDP6Sc5twTmpdY8dqjBBC9xIGr256XoLilifgq2XBlQoCpmtzRbl+xWJJwhP0qbFyTu8g/ftc/5i+PME+cwg+NJ/YUz8w79X7WMyyLYZjRPa6nYHK4niQVXUqlYD25RMSNfphc0YCfezklOqVYnZbd5LbX/10cMnmWAg/D5dFI3zYjEY7mcmLGVGxo5putiyF6o7sQWK5isUiIXVbWECPeE='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'g6endUnpBM91j7VvPQqACwHDJXYt55vyF3H3VxeobEP7ItvD7zHryyQgTHtjxxwi0Xq1KcOdZh1fJGjUxAHFJsheQlnbbHxdqBz9ELXEVL7YqwiIZW8BuPeV9pMB8mga');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
