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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '8d/DtrOQULOWfMCDubLT2Ezuuu9L3d3qGnYj/3VkOPHneNLbHH6jd8HcDi34geCtUIBJ5p6OWtdwx5lmgSljoaiFGNvj+DaGlcsAhJ/jLdshSnAJwX/3YUh7kdl3F8mvHSh31U1KIpkyJZDgMeMceaaT2pcWwFu2w4Hg6IrPavj2NtfebzfLn+0BTGkoKFlFNOofnMo22aqyyYdm+bctxz6PtHvhJ3ZIkrZCke9pFirJ6hRjMiO9XbJPbJus/UvdxEztcZmGY+Cr+luTMCNgtvFstvejB0eIo701+nLgy6I='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'NXGGXf3Br0ozMIHQwmT/Tyimy/4WAorB8fv6IvGGxtVyEOR8d3T3nk/lomOVeWj2QbczsQ+CoOZJ7UpQhPeM392kJ0GLhSK5lTo7cU2b9FX3n8j9XC0KbDRXoZavqrls');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
