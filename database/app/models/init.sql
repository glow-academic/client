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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'oecmf8AkaEiTQSNdNVaiF3AKelQbRTepoz25CcAkEgBAWR06A0LfZ5H3MeS21q0uMnDCTqhz1ds6+U2+0o8+knAE9eAdaOeCf4hBgXmrp7LzYkWreqjiSUw2AZTEeBIMsSnrDgx9e0RzNpwJcvBgk5fIg33+t5CTZ3HY+FRYH62Ge+0jWzPYL54+5HCdMM0QAUPSVTccH7R8TIjsyqHIH+PTXZrp88MXxl75AbYNfcCf+BIdsxui6xci52TZ67jxV+dXTKycLuRK1mi4cBbhuTmcnPKy6BZFVs8fSC+cSVc='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'SDuAkXiDkDW9nroGLS7kXmKq3wNwYNuPZREIpK0ZGmvY0/v/baQg8eQ+YPltGDjWUsU8SC7NAU4jgMta3sGV9jU6hYkdeLuh4TXrOam7aphPjagkA+a0zeFQXfb4fJDt');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
