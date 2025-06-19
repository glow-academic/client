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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'NqRzk/xe7eogAyTbezNfs6GAGP8zG5+5SoRFLAivnuWUbPyLEPtgTo05H4Z54aZEQnKB2AWJnYUU1pLxm6SqlvenmRtJNUADZFNnVXcjrwz2Jyf2KyOjN6Hi5Ow+HudlJ35287Vr3FgS9x/nLQnMC+Q+e8luQp/WGdVvVKc8YPGMheOZBGuRPGuNruOmxgHdmFf/zeweTbn9ppS9NSGHeROLVeounEnrL/6/Yvcr89zZtvro2lTgO2LmkbbEcUyPk9Yzflt87UgAz0rcjpegBdA5/vbo2VM9YZLF2pYhQzE='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'clw/u2Yq3z5pFGj7w0VKKEHwEaf6qvZdNMIxOUNwNTdKgsJF4pNwj4FBGeSAsQ87NhWKmZuX4UziMqVuMSyvejypfE50cUOizzjOweBrDoDuJgntgl/o5rupJIlb/dsX');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
