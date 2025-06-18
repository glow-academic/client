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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'uOxEtdBqhzNIo7S5yyT+TtiqISYoNWVUIFGNA/CcKGe/DQ2JH4bsMPzB3U0vAhV+Q3HAqTMO6u4I6gBqJpmJkcYpQ1VA75ypcWn9bes+fiCj6iXtW0mSGpUV4Tm7dvQiNVby0f99VR2XkgHmiMTVh4lsmBLBNSneKw7pOUTzAzoZVjcL2bGNI7NaFwYbuE2rIL502foC6qvEHkvyQL+YZ5ftP0njxnQ99Bre5w7phmjgQc8QduomYuma6a0Yq7a1AVgM4SSJ6n8CjmW6ibaAw61nTlWlVPNnXAi9fEbWOxM='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'TCfHqoYUkZXP6wDJFz6RTBvmjfxAuj+R9XrjQRX+4U21rwLp+9ftp1/3+rtib1FIrLmpHRs4+lwT8xH758oUB2f7mkH1IqEPQfNK+uI+6IaQbMwA+33vmc33V5fZfAPH');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
