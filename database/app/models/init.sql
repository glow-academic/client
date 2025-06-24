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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'UWXAj3v8x768oVO/hAXO/PI+PvWg5NTgiLnK57iQWDMiPo8OSaZ7KTbbb4UD72mBJRDVyPKs+Jdi4IeARbR0SAoy0eB3dfWacux42+Jl6+mdEK2j/vc5LPxJvXJpTkYFYbeoI0sCtg6xZR3KKueQ0LjpR65vuaiNMFBKfDCV0K2sPmtvDl/hYlHZxzdUkdPMLyCUpxMKQsqF4YgGQvNjgCpwLeBK26LjGWoHHzyR63R+H4dC4NtPj61gyvgc5V8UxioWguL6OWrLj2Xx//0x7t0LCx7d33AIpow1/strntM='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'x+bCAbqmPBWW55maAC16XPotcPwINLrL/hLg2riR5slXS58cBJarOiczK9bw4DihjlVfKEes+KNT0yojgg8Un/Hb4jUEFdkt5OTc0G2w48jBJEr5mMpz9B+06qzVuA4h');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
