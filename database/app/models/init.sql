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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '/pFDnziBjF+46LnBANA8hOp+NMY8BBmCZ8T6Oh9qQfsK1vAS/VsQT3CwZNk0Ym4B3H4K7J/zLhrmD53/VR1UIu8JU9Psrpkd9SjvNVakQZR1DipFfFk2w2WY8DTMkNGcE2ZtEj5qlFT0Xjca7p3qmk0xaqZhJnQNNqg0YlYcpNRS8GkwTvOSq94Y8ZMTNTUyxS6o4EYU8Rd+4Nht/JjUlcHvRUg7ZVCNG6flKJBCaDFY5UG690DCEjM3uNzOXA/JBtnoCaUenI+ey4TnxYSc6lDHPDrZU8fvTzoUEG6SYKI='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'C8g7d8LdPO1V0u0XCojfgfdPF1EQ81uuJ/BUTcfUK2hrTRcsGRDlO/6pdaEMbzG39mCEU7AWj0Sh4ApqF4UY3mh5KIhg/p6HRBYE7Sk+BmZkZu7qMxUYZY9di2fZ80U3');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
