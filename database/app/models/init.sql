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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'T7SlqPV3lsqUDSHM+1dkTnfMX2rgIMCQKrU7GolNM8ZtvyRTc8phPLtkLEU3NglzLkepjFPPqYP5SqZYXS28Khh0L1QGyhMome1iGsMXmkOIbwDufFQXcND3bRiLX+iLL8LX/1Y7qQTOAG5Azhw2ZrKtdUXUdUjD3QU1ZspQIMgXfced5OYC/sAVBH6HOuufrX1v0cG14SqmUR8u5277/e9IexTmTRFEpI6KWKFLWj/d8vvc0dMNqj756AdCt9t1++T92yD4a4JpvWxjWsYI9EdhBTcx9YYw5pNYaF3TJQU='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'KJFMGpnlokNTUvoqDLoWbCnsQVQOPVrD1P5lqrV0S4GLD4XPtRtkWUOtn5xDSW/K1ZdVxZAO5AXSTx0/Wxce/G6qLepgjbnZnmv57UO8KLrfAXbDK+JkrEVitd+g7Rg+');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
