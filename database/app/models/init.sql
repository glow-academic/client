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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'KPlqNRGZGLMat7XuGl9s42VfSnz6w4LJCowds/n2+vo4KDqzxi2xm/Pgj/aGOVa7FnV6WhUVtJJHG5mUOYHr+h/QQrtR91kLfDMMs0aB6hdBLEZ+IQBGMthNGRpL+26/Oavs/w7NZhhlDpg6NZsF80RMu72SP0LgvSEqK3K4mU+mTYcdGtMum5ydj2FAVNAkNXB+PuYpseMjEjH3Irh0OoQ4c1XXPU+Lly5FKhhMTt9N6+mBkp9QYhP2EgMygCL70X/264qXBV4TmJX5syffe/ZbU4ZGjGKaw0d5atqojaM='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'GzieQ1xK+IIiFOEsfGusrKDQEdXRs/K7kYbu32z3I7YbhGeKZl6VThbRZPTAZ+izWvKq9Xcr7Ly5SFTUiOaf7Gz7MmVhpZk2C+6gUfCgr8rvr5IgzdtmPYeFE754bJ4+');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
