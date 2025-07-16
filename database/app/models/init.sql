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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'YNajlAr4auiN10TKuZDh2O4kBMLgYv9nnMDtju6JxlXAF3/WCNPkKKLe4LkLz6IYZnUYCv64vJt2HSCMI2s901jFbTjNElOy+jerMFNMDG8C4BCpxpRnNHApQOn46PH133uqWswmOrkj//R4+8xDPehJk3ik0IkVeoxuM/qDElhDIPmfqwnhcHU3Od0pIFlfjPPzdbHGm+j1wITjMQSZFhlnWFszF22oHrvxfvqiom74t3Rvo+yvc0PFUsA8zm4qT5Zvz3RaS48xs/S01v2kBZdY/pSyN+KkGbjkJImfnk8='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'M3lDIj1ayKuZfb1CAhWrUCIZbRQ7L1QJVEaRhZFy9xmb7KEq0WrAKnrcwTvWKW15tdQGFpdz3pXKyQM4dX+0YoKgIvGCLebGsCgYECLX9YWilvoDxmGM+dMJMaOV4FP0');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
