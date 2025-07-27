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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '2W4Eyerq1HMFVznYUZQbNC5VNPxIZY5RoE2Sx2YHV4cEHpcaihNK6VTOfYruVp4ByRy++DaDVNlVJgR2h6iqphm62VVc1+rM0WShnSuUYSJ5rEuAH4Ea3lfeJzZCE2jrN5FTqA7TOPLUIK5QDxjjAPMyeyaKLtVLawNcj74s8NUGbm6kRyZNsVePcPQSjjtfkDY2s3amoe4TwP99tTfz9g0prz2w7QGtBaPNK2Phu8tlbCVQCKErhr42UE0n1FlLCVz3Z2pcExT8rDE7I8qfNuGtZ7NRaLM4xNwKwsyKMDw='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '4xz2ebcEOE8dLESmexivEghd43MmCN0myTQbFnwFvYbXdoxHmyPZrsrorNRSjXKZXi3oTD71+qHjElyDlqR5vi+SBxoqqoqAsq0IX4rIsDqyORJC4FVnEu8SqTbzfq+/');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
