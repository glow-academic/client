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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'PBsjTzfkN968TBBlcoyxkI49JPgnl50ghJLgibOY2G4to50vZQYo4q41/oBss1e62aAD89asp25TvEu6dgIuH73GsgG98T01g4ekk7HeJwgohS7hEXUcWC9EuAScIoTVRH9JKFDYljQRMB3T212gyjT0RhB0+8pSF7UPFcJ8AF67xllQlVE/2ajnGY34pTC7U/W2bwNKN/LxtArkwy/weowkfAZ8MAosszxow8gisd/AwZ+ziauxVRMZ3HPc28kkul30pT4fw4qqdD5T6Ykh6whDOWH67I5f9rwNKByTsUw='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'fHxhLC8l2g6yjxHAGCzMpcDKbz0y0FZ5FCpOWcZlAEveALembTVGZs5Ob8CkIgGHcZou7CatL25FSYThTizSRW1j+T14oOmFjFZZiwjTUzIPJpbEJ6YmvINCLcWrmMzm');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
