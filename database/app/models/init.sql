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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'L5d6s1IrnSGS6fh6qgmQAf73yH3LPL+0CK6kpaGFQDWrHhsexiRiR2wIkFq+R+YvqH2vNRwp20E7geXrBaesjqqjThstjbGOkFgXUkOsL4K+cAk8uTnaePcjYK0F5UlbuhvCqxyzRX/LHY6cuf+8A0IC6QyP+2lz1YerOYDXGSm7ume2aKibJNo38Wxe0PygH9JLw3KaIa564y0XHsRZFBdqpM4/C/3fIxKvv9qHz8AIIHiCyvJBRb+72Xkx/7FVLQ5b3Ci/gIXO/jaRsid78VHsL5UDBGRv7kTNnSKaqgU='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'kUYafvQl9U1jnpoOH6RcpbGWA5wLUdumFeEGiqaD9zyUmCOScU78yn15im8GigzLqu3E3ldFSngRMwmssnrE5JUbPFblvjQmGib6PWO82wZ8mB2wpI+929kDV67PRVYe');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
