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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'KoLV0XpNvbEY63HOMKWyEHzyhNs+d0MKGXMwIqR8CK2k0h07rw9WbNTiNkQRgiiJ710V1rK8bxabUB4KHwPMJgvpawnKD1aC26HzvijqXbV44+Gbhbg0tF44qs52Yu5W6GuX4Pd5fjQQisaNaRc9oPnfWZLIt/TicngSh+/S5DW8hCm9hIoj71mwsrfgEn7wnbMsh0v1FEqQYw+Ecoy0L7ywnIIKa+6VkQkfr10jL1QBL/0nQBjFFUdz0a2XemUl/Ex1EUaH9mLVKXptK1uQ8AWkjuciFwjYNl9j3V6YiPc='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'xnrCdAItExt40i2L7qUNezlUDOVEWkM31YW+zLxiB3jNnHAe9k+me7FiunA4hdJxZJ5sb2W1iIBYiMVnPb0QKvGXGjS7iq2u72y5e4T5pL9mUSmZdkXBGJMAsY0apAhl');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
