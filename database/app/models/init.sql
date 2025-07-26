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
  api_key TEXT        NOT NULL, -- This will be encrypted when stored in the database
  base_url TEXT        NULL DEFAULT NULL -- If there is a custom model provider
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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '2YUh0qb6r+k8Ipq0eNG6VQB/gtajecMctY81B8Nw6V5fIFZ/Y+02QSLTfT4Biaxi/ud1zlLN5956p/VMXvu0EXKfVApqbCT382iTDENdGE9DbOlJHWuhzArKEcnNl8364l05vbuV/2mPfBe6GlOP3zgZYxAe3mLJQpYCMrYZhGtNXFgAc7ajL5Nk9xzWjZDXp0CYt7fbNY40i8CftZleoqRKpEAdQbPnLqD5qWu2C/Vq+nZdXtOLT9hZHWvpbZMdlXA6FdTlZk7eCcVu17WE98iYK5EffSFqjW1HOpukUM0='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'iQ3iFqg7cY2gYvwuh6bPGAQTjtdiJJi74EZ3qbnqzSNlXcUsW3AjtyDuszHp7Cv24x7eWAN2VwpQ/uXYxhSteyiDE1KqjRcxP3IBiTBjt0CghWUZtMD4gIiO03wFImrx');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
