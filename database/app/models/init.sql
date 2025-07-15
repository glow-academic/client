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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'I//qQGQThQilFk4Ngv0NtfIHIUB4ZbFObSO6s3LFHbeNS0EhDn00+j5K2bxYEQfl1qcxPTPl/bd342dncR8e8c7K0yGUtefcswcERExyWfV9kLI8WjzDRRNqUOXgtZacreSa9p+lqbiYb5QKSmKpiC+Jd6NXUmL64ycTUO/tc6JbrV/W4AFPLL8a/k2JIKxxdbgtdCMKCC8yMEZ5ApNbz53WJ+IzDjbCBD4OyqLNrmCeWDx1O826GQ04gulUnkKqNxe5xOU+Tx4X/4Vh+s2U0vpcx2WHn0OXTa74cJEZW8A='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'UAuZDWbhmNCX7IPzNoJ4rUpWOKqWkZarTOCbc8LtarhgNWvsa4uWWFHgfQ8oE11dwcmxvJhwPjTb16qqlZPe/f6mMSkW33tazK+FIHSoBhfsbmkoWtFtccS5fahw/gv+');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
