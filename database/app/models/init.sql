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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'W0cV2AAu7rUUqGmQp6L4QAOO2KlHF2Qp7xeCFXNoRFI7mPiEBnw/ertyurX53Yb0bob9nKzAqeeFhzzMCD11F/zPVj8daWwHSGXwXEwsxh4NhxbOLFZn98V/89pSWlDXKk4ioZJosSYoLppHx7D0/yASy4r0eW1EQzrnrWZAE9oWKIoUFCYMNfXi3rascRkpqu6rg+z7mVNgCCUXVZ4M7tm1/DX5wcLMKSpCLDXRXIoMp8t4Lh5RMivh2aNBV7rf4gjWmJBMYSC4k57MiM/s0pBQB5D/CRfZevy9Xspvtis='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'P+J60m+FvCC3/y+ooyW0n0Thk6TmDAfLCj13Zgd6xxfEuntSZFOmbB5WCexaHfPowTifv/ZlCeyMqQxh9SCJFIxaPALIK+QBU7NCl5TZsq6O8ZpFY4SnkjUchkJvVGIt');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
