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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'eFD5suPs1v12f0wD2gJ2UfoaO+lkDYoq12jSfJmQcPBg9WbTruwochb/j0FMcLeau87JOyNfvdgD7OBZS43zML9ot4Q+7fGdWHW0un+0/PDzsv1jkE3VD/81fBMUeiyConiRF7KvSezSdw1sNvs/o3fUlV8rS2GLycCRVftG2PWgJU8B4LhBNGQZxJVmZx948LEaYNLMrPp1K0ipl45Cp8QrRMAXDjNbfD4jUKQnmqF7JVD6xiRr/J+GMlq7WYpsqIZ6ReDH/avJ8nnZPEFmrRdc6Af4Y7zi3S/KozLK144='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'jjVvcMKfYqDSUjaBnYjvs/4xvP7oD7Znlw6OaLwszT4JRwqbgO9E/J/vChgu00VKOFBANj09EximMuOl2YYGR6Cv49h9WbCyeUPcMIg8G5xiQZ4guj4wyJ+JxJ9ydm7K');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
