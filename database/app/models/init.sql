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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'jhy1Mc46aB/nSXHrDBXEeaFMQa4Juu13rSoI4PwI6WRif5onBKjX3rGAdscTo4PlVXuPy9wHd/EK+llLnv24U0ekg6gE5YQXePaG9rFjt5ILearYjlonfdtq2QUE6Lnd8f0FhliuqWd4hBBsFCVoM9TviBP+lFyGPY4U9lxtFe/m4d7suNbls0Rcib3cFjEfX7xNr1p2KfkxBcd0z2wKWolTvf+w25izKgz6Wemu/X64eZp8+NKvkKfRKQg1M1lu+No3Oz21GEzZBXZGBPAkt1UFhULPfBsgUvMADQZgNQE='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'kaI8BzpUgDWGLESR0JmehI5voWPJkIElHmygqayYIb0t98kJFNAJY3R6P/HDXtvEAxyug/Opzp+Uqr2R/u7F09nLzy919hIiIxkOXC3QTuMTz/7+ikheJRAY03IiLea2');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
