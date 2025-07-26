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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'k3r7Vdi7nbWcYpi4M5T0pSIofp7ckWR0Rdpke2ZQNjy8yxNGOTUTnuc2M0fCXRGFwEe5jNZ2ccRh1196UzXS8Yd+YW/qDmcVDGb0SRzDxuP4FkQqNsJFLlFbPB4oZDrUX9wGAe58chjyODXmkiGPuHqQDBRmVPFgPrMNljXxXDRntFFYiZdMKOnyaD0L/Ro/Z1J+51BBSNrECROzuK2ouJ+eCnQ/ER8a9SIXS4PLcq9zx9PoXnk3m3N59HFnzdY9xmecgLIZ5p/Rjcpx599lplFOmF41PXavJZ1gXcylwUY='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'AhpV1iCtS385nPMQDiX4/dfiTQ47HeCzQp+Sicy1NVB3k2kXdw3qBKC8MvrEedXvVSNQF1yIXtBBqqbfcS0xmmDSRfU/z++VfgQ4exUc31oK1osJUkIh0i0zvQkVfhDJ');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
