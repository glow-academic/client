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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'X4RGoq4S95uGkS8waOfilgd2Wxa9clknFMLeZpmENhPjNobLSm5xWBt6SgXnSHOdXdFxm+6Wpud2GBFIV2i/6nUeyFWGmzpSdAwbp3o+OC5THjm6goDIe5RLtQ16F/Hbmf4cyxJLv54ytjszZkRiHR4WiKeoSzvvlWJOLmFt2pah0B1rTWKeREFEZ65fLOWutNsHnpTC3k9d0JI9GBWVx/o59LI2wSWi5iVI66ME2KGT+nvC3Ul4D8Bv5TxhVO/C3DXZpE+AJZDuBHLSycKNfs32L7q9WaSppoZMTfkdioM='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '3nw7JCEf7pwMmNRZ2tsijblYN7cQ4fcOWMzbDy6IJ022HerBvgj36edFOtXTR7pZS4NP8Zj2BzJDF29cmJH2mhH0RBtZemZpZHp3RSBNpX3cFB9A+G+JoGOajKMB9ZwI');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
