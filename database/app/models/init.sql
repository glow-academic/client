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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'C1XdFBMygBbMDAZdKSSJJUfa/i6mabuLwMMRsRc99xNTSiRLHmjWPOHGrmGrKvYudYDFVfXQfngVfLX9wLr8XzGPkRr5FeAV+o4K2/UW37PS8XowQMs+QXzcirx3gt/wXJZ/MSkz6nHyDL2j2UaHxAsM8KLyFSX08Rk/P+8ywE5AxpnuiQ7FlPfDGdr8xEEJNqYPFWNeEyHdhg6lvxtmc0gNreg82NiXdPFNKEGJMzrx3tjm9r+3DNvJvCOKeE243WEdrWKyUt6XERlqVKaQW+oaE7LUGJeH+K7LRNponuI='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '5B0OPCrwLoofA4dzDwtak/qlzX6obwFVJDDcG2G6UfaHEI2/8AEDG+aIqUK3FtLaeKFnjzLSRJ8b+H6QNaX6LYwWX/9O5/RoUAoNhjYEdVw45PWrnWVchTlKjbGqr/4r');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
