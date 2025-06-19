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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'Y6/C5Gw27pjWVuenXJkCbdGzm6kHOXXC6S3biEzhWkqWxAiSdAgGpiSa/46u2i5l6QSpsqKgomBeB05Prq7nFyjyIqh5VYI4Kt/TvUu/7velnmNx0NtcsF6ladlVBEPJGETBgw20NFd7ke29kRlfMPQTDrTV7JY+X7W+BfCtKNSXBX1IbAsDSRKIrRjRwnOWKYHbCAyDWC+yQHaMyr7+ghZr+h4nMPtkIlHUaguoP6fGoRqTTh1KjjiPKdy0PXR3zo3TQHPTV3dRHnIIkAHNP6MQ4y/jeOYG5mMYu154Yl8='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'Xl26T+uNp7UuvVFme7Gl0QsKSJ2zvKgG5YR/RIVAyZ/1/cNRKZP1eibpfc+j4VKbQWOp241nhq4a/aiMQjQvrcTvK21sbeA3vT+31ChwGgnrQP6y5Koynyvzbu4Opmv+');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
