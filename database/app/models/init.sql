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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'J9rlJXC0iOD4yf2K3YEDFGT2T5kb10UTcUXxCReHhFzG2rN8JjMpJCYIBInqka4faJkka6yoHmhE7YkRmrKJ+g/VyufB59XPwP38ah46CbIw3mt3W9InB1+hbrXKE6CPbuyN6iKcfR7qkILRPpCAbLOR5FoQ9SIIU7nkJZGSOUHbPVIIHSXkcCv1zTaQ0YJ5aPz44KHv+euoD3rKhzI3d4bv/uvV6qBhr5KARvjTK6Sw+DCSPPN7gnweJS66EmYr5t0fPP39le8kToufhQs6FKFRG3L138lnD5m3fGIf1xQ='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'xxTafRHGSKpbbIEbS+KiAYqAGQl5NWfmqS0YbFQuvp0XYLPdCDwbzQnDpHDI1vqLUz2UOnju/+py29G1QsN36g+Eq4kKMQNAm5X96jZOadln0PBp4yYuQhwZZbxo7x0Y');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
