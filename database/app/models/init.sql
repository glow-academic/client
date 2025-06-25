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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'N5w8QcJQRy+HhxiBgQHRQsVzJzMahKgeLwpb3Q6ZL0tNB/u7iG2j/skXg7Lz0fliXbQkw2ps26B6PMBMksxCOSJmHGoNvRzg04ffr82MxuJNFyZy+Hkia70zGrWyop1hIgHcB9y+IUvCnhcJc69xPfZJLoeneGUgQ1hlY9hL+1HG+mdf6CoQXY553YRxW/URLfCbkMxJR/+PWyYl3V4ky58Z3uIzrSDGzEPVXqwm7SbyyFEW4L9s46OVLO4LuEkMLubW0Xnp82XksFVZ9x8JqHn4iN1DhGvonrhijG2HV0c='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '/3qhi7zZm9jIZy6vC67XNAbmabe8O3FrGVyDx7ljIjWS39cZRRmnAb+f2Ig7uGzCgOnjQdNWwTJ4Mm3bhzyVuijew5/j4Ce+cZsJowSfIr1T+jXnyVI5v1XfYqHFMLkK');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
