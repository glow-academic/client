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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'FU9bGtbC/9X8oBVLgH5os7DpXFsmnIH3Vy1Cv8cPbBvDBfFrYWkRNqhr5/YDnfe6o3zli6vggbZj3SbT20UmZ7llwXxzxbNDxh/cd9dD1xHbrI57U4ue63+dpRfLqROUMxJAA3VnKERW3zZpRvJ0eyp4727FzgLcI8qE40VkxcqqyCYQ7bk1MTyGgPKDdQcIUWYTL/n10XGYTa2iLAYwuIb52R3YwKHAwa4c5+HYDbuF9Znh8l19Zqn1bx8Fe85MaP5KLv/prtdnU/4DKuLe6yvUrqDhxt5r1qTH4m6OjH0='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '/1DnykdWl6akj86rG4mRQrTtiW0Vku6GYJPqjymEdR2BD+5/MRyuCTaNU3evl96PtV/BtOwIQevLtZmkF48iGP7qJyxZphSwqZqnBD2gsrZonkEbB+aNkUtnoGiT/Wwe');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
