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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'MwK8SaBQLPxjWcZlJRBTkiDSt3QxajF9VtZ0Ku0X4WRDGqnWu8WOErbDB/fnvagkIJuwXl4Jl2wkOUDU6buFT47ZzznJyI8wR0JIFhGfOdIl0R+gFxmu22z5Fg4Lwq8oq2DcgPKzYSniFL+e0N6T2gYQWHVAmetDnX/EBJdbKZHs+OvjpQQsJYw4QzddVmVi0+DQB3hstTrNiE1reKfcn17l8EKRV2MzUU5q/Y+7fq3u/BZbVVlMFMgX+faJFyjbR1FEF4MOjkTNfP908oGFhg83ilQMpxc1JySYRYwLWwo='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'NN0rvl6EIPl1VaoQw6BVc77iG80bKdmpk36GRHJmkDJ7pM86lCOg5lyigw1j1a0kzJyR/lOuMR+otFLkxxhuS2Mt2swOi1HeniuB6wAqwJfC/T1q2nRpfEDLmchLYcOl');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
