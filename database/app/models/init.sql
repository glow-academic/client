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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'O0RUYJG+J6cNTXAPMEHrzplFG+LQWo+B6pg9xVnjnGXt9CLSukFPWymMez2ulRGTvpEwJNQ6x47V6oiTpbuyNUO41Ngcx7FXBjr59ZaAheJeNBRO11bqXbG2I/Km97rJo8hNUs4zd+Th9KtleyVP+ziVt0jSJrFmfflQvuye/otySo3dDMI2OCNyfic/xeb6uc4giqd6b2LJKzjfwzxJFRSjRV3lmmwwEIN/ZacdULUxp/S3jVygSNwcCI1DVcD4Y5G0AtZMmq08G4VnUGj63WT2FSDgi0MX8P38S+tPweA='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'QGF+cxN8wxa7b25mQcmdtf/nyFSHiZkMmA7Wv7CUzdyB0cYzr1DxwbiJ72CBW3C29JQg8fGYvg0RGpbwrpUvY2CFD61hZxOPh6qtgRvEDA3l4FZGiWWl0zYfwcOkOsmE');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
