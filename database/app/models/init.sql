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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'xeJDMuiuki50NiDw4+SfdnJPQ2LaF2HPhFRope2e0HvvNPbEG4+fJyhf3Ko0iNqHA28QyYf1uSUKFW+ppeXy3TnjL3L0I2U2Xa7JSQBDgU+6a8dCre6daYyjM3w0dGMY8YNOSq4IifOoqq1AiQ4WHv8g7mOiWZQawgnPmB7baP9Wt1vTrQZvbxNxanKW9lXuLKbBMyLpqL9G83WlwhhpUOgrTwdeH8ivDYI1dsvzIiWCCfLwfG4c3D6Lf/ZCiNpVeKOD2I7bw2zaKasxiC+Za2DXuDDW9d7RlxzfBVkd8oM='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '5BctNL81Yg168wE31T9yl2AIPG9h/gBkxHrMgvFCOnIGiIL7zARH8OEO9grmzaKIvxdcLP+EQ6eC1Vg8j96EoAV3pGzMIgsZvDX3tH7m2IoGwdfRf14krny6H0HIuat4');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
