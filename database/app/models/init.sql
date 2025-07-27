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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'mHoBtRHuH5zlwJP6MYJVSFVHw4xf1lMx/l9hHIumCxz66c5uSNHq+p7A6mfDWB29CBOogGy8mCFPZ5YXrBRfmd5DaHFqfe66FjdbnW9qnW3C/sIoZpdbmT4o0LkGkofss26hks7Qlie1eDwBGmeoLymUI17b+Tau4YG2MhEC5VT4anUEgGMaiDgcaj9g3pmDq+OTOgOe5UaX7USenThVKr9AMF74Wb6jJ1rGttxANzbNRjxlpiUsN6pTh/199UQ2wKXalthlS31Ce5FCNroG3pKcOueTVizT89OeBL2KbnA='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'IogFTnxM3HBEByRIBYjpM6PFLWfh9hswxT1TczAwRtULRBhXKJSubJeQdysXCCiJkLGgg7/RPKGxSHOE5Sm+z60URZBmXricFeIEz/cxLHEhhmPfvvH6oUrza3+HXWqf');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
