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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'LIra/W58m0FNXPq/Ed76jlryJGX0h6vRdFpPwWLu6o0f4w2wDSpSm+IxgXS0r48OinB/G9BPl/kiuUTN+LFvfHYXhTiWLcfx2lFEuPEkX31x3kpPiZMLzFmz/4r3zOFlPUpygTJycqaXkQTcrqhTZmwFGtHzOrpeRxuq7i6hwGE1L99L4pRl1O9p9iOwgb4osehOq/ZBl6RYEIq348y3uIHVK39KU3X6WuahD3gaDoF5KGCIdFE71rD/g6/R1G7VzdX5jw3LHsOjCpH886icHlLFshBnFU7kefzjTGZ/YJI='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'TTsTCe9I5O7XkbYKbThIbLPtYv3EKuJSv1q/MimE+gnAn0upx5stIUyipVLiFZaVx1aApCGTZXkvMOOndja+kSQSWn1uNAm5HwHO9tehXuEskSLKFDeHr8VVUowmlAKk');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
