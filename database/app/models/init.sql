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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'j+WnTTvFGM4L0ERlSKyQZQ9AG571CTkfYnjcN9s+IHpMaubUjEPi2UxdNSbcogyL+AEtzqigzfFDwIp1ShjO7ginLd/PqdcxCWcl2f3LZC9D1vchvTMF1eeE0hXK9ywancdzi6+bP9XL3SWFbKUU1fx0EuEkDqTMQih0bEQG9nY7iVLaQuet/kDuN2jxNguN8QSEFHgB53lybAuukbHXM0mhpN5brPz1wz0gH15YqBveq2b5yIvNwiDSLh3nuH8gHl3EjCzAE8r4MSpm6SkE5MODw2QgadVEP0MV3HfRyHg='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'vA+ef4AWAegQyH+9ZAZfkUPMG1fVAJ/VoPYe4ao0Ova6y1ZhZVkYLEHscHcWUaQC0A/plfTWjR0kOTdT4z47idHAoJGYFKVRL1dx5oAyMeEgfpeR9CWmPHXBM/sVkFVT');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
