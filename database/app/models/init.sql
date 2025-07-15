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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '1CUoQPVHdwVTguT+Qdd6WVuMb1TYVfs4YvSlbHOvohXpW2OZ5u1eyNt6XJudCsOLwjbbj4jUU/ea8Of6XA7ryrsoFjhWO+zMVj7r+re1BhyszMlVf4v2+zM7CbSQCp87IxTvw0IUxycfqAu04rKoCjFgIKSedSqqBW6KyneiAWHQoa+7GSzEkBkX1dGqAmbHpc6OavPSMnTehz7EHQmT1gxEVUlmJjhHMAOFlzOmcBGi1tG0iBPJS8HMJJXdpC5q4bNh4YJWJFwb0wnoBwBk1QI/RBcCVkOMLvHTIGshf2U='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'mFXIN4hsfVZS6j2nQV7FQQssGir8d0KkarFSkT48GZ7BkdNsi4LzuRIgs3IeDbU7bWCdljk0PxRoHMyp5a5FhBhkm4pQxSqZZMKHvQZSqumdkBPzU6Jwlp6GPVQr3fq8');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
