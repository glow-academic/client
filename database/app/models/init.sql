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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'dhO16Idbxmxf9PvRxgX0GvLwXolFzgdwZsMIRMS1SJC6yL2QzyFGnF8Sq5HCXzkFc57DPn22uIaz1FTplQdZJrGt/JS6sp353kRy7hWKJUPcNS71RbyFZ+bjtTF/I486gbe77rInic5PPyWYq2yroO0sq8FGkegzsvYHQYJvQxF9+MolwG9vO6qCj1AXAVaJ5UsvCHsPeVlgOXYmoZH36EKwnuOUsJQ+p9tfQIS+AHfrKK+WNBsxp2QGZPwRrAn+Gj498P+vIvkv7A5tC5u5Oz3JOH2icudw2rQhDko/JJk='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'eC1thAYjuFXxtVEEjx1VUSVCRBHi2lFsfdDgTTKz++yvqQgL7PXu37NbRUuJIIkUN32BhL1g+9fq7EE3optAD2fzxSW3IzP3BXKyX51K9QsHfdgEwHzMJ9JEHAWfkEcz');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
