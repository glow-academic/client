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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '/PBORzvhqrlhiHWRWMDfrejRNZ/WQJwjX7fNy2vCImsR5prKn+mL7LD/8E2tCY4vJPCNFkgFdbjfiP//VScyLmRHTYT6Wfht+O1zJySt3sI3AvAwK0MNcoN5kjdACLhupHiYH0IhaJehaB4BKAxVqAZDSb2aloWO0uGS9kJAn24k15LUjURjTHLe3XvuXWZBTHwdhPyv0Vfjq1AlrCwXL9JcD8DYia5q4rZtmNPZ7Tm1lRT9M8XxIsqnuFX/RILIyzOkVyJGHqz92Xu2QLhkk1pFLTBLO3cf+hMDrmS4rXE='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '3QFaWmoan7U74y2nLcYLLf+VK6l23w+dwwLesaa7KWiiqT/LneITRy1Lpll+4wTURrdxMcClZgsp1/qz8eYpk7jdAuKo4dUtrJmYN5J/ZBw4K98c4u8y9sgvpk8hv29+');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
