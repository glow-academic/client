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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'Y+lAu4h2QjC3+sz/+Nf5XQohHhAi5287jjPkFCX29k4ve4BH7opH8lTr6R0zvR23F8EqXmbvj/dDL4vPVyVSw+6tJAht8H09ukQb7LwnVqlV16zBvVmiWCPB0s+xMjO58oGGQeuVWLobGAq2s2slDamb90ZJ45vmnI3QDrOYwRl6sAee2nZ6l8qz020ymrMcXHGCSY6P9Eqt34B08CaKWmITPr9k0oPBEgGg+2vchbqvAh94PURTBwY9xinK94NdZ4T6zWapnEPQcRXFYGEhDuxfjLQNPmx8kh56w12wb20='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'dIcllQyFY76KMCAIUUboPFOAAjOsKd3wJKB6ppt4PsV/wxNtb/PlQTUsff2OGRVUdT/6DDvkhb5Gw4IoFY1JX55KHbYUBvW58zmwGmyRnNWKzZwrCzRx5CQ4JGQBrvAl');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
