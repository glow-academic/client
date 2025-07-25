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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'AvyU8V9iRmyAEu1c2b36jve/p0acZLmnVvg+P4dSND1YDc78B6mV9lUfPHIXn8lDGG7tnKTZp9UMKyeAzidmb+AsU9axc908uC/qxDgWCd9k+bTRxzvGnCdcvTSpx5v2L54NKEwixJchRHeipymMzdwfjoaeyumAAnuu5QKqz94MKe5CnoKXgJ2GaPqZZ+U8B79VGFc/0Zph6w/LRT5E12r9GyWj2MLlwqI6pEvjxw6br1qYWYqHWAl3VY6WtFoRG2Um824CzcAvaALniLy3/307m+Lg1NYh8nG6YN2i0rE='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'sWsYw3cbfxKlf0SeCsllieWtCxfQeZv17MqJ5GCwGwMeYey0kASsNrodMExVNYcFmhRtqe2mpO4lt+Udlpo1TXsyOUYvg6lK/FZ6StGwzZAM3KnclPat3S4W8ze0+mc8');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
