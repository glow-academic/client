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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'R4F3O0k8KnnPE1FjO7Kb+VLVs7s5ca+okHJwwLonme3QwAqfMWIZLOA32rSlPJY06OyLqzKeexLWDNgkGpaVQvKxD/PQBbpItDYy7xYkoLKJS3W6gYiiwiR/Sez2eKrNNvZGdu/0EtCIWWE7cUCAGMKvk4Vpy+iaxUXwazeqpQp5NDvOfAHB/+NN3FWYWfPCbHri80CkgwagXiCdS6OzSZKmFv9dkeVI0wVhRhaSN235dsBwm/wUA1/+A6HKgyku3NWtxEBefxrvJRneP0l5JND7jIIhDA5zbn+z6OdgkAI='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'CkgU6GHyEon8rG3Ad42s4SGzUK9An2e29VQi1RIop5jwaJ3ai2jzgbhIfmhvcYlNzSutiWwEPeyK9zqS8EoJM1hjqERhhJtBts5dm3tq3axPNLhkUTBRCQNWTpN2u3Kf');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
