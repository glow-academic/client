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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '2a7lEtM2UbC8mW5HqRSEwWaJ198iRCDTaMpN4eoCPW1b2xGCqKmFNfaSqJR6kTSbhcXqcu0Tn1/m/28S+GzU/QksWv2VcvbsA/g1WfjWVQjNE5T9ZnD0kc638D+R85qw9g0mCwpxGYuhJ8bCpVbFzAxvMVgKUP+tQDvq7lwb5F1p3sX3ZwP20mgTe200RdS0az0j6HxtYoDPc05Yk1Q1JobgDyjsH9RYCXCpjQdZzbT0p7quY27Q8Fm8VHjgme+xpjhDKyPHk+oXEFHv1WqnLisJXy4mKoVrUCOZ04REaz8='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '1EEPiZ0yXam6rBB0RQnAxwJgWf8jYA/0TPB4gJ5ooVR264M41cfgbhYtBfnh5KfBLrqaPINxaxC44/H9F3HBbjYzJ48h33VWC0ZE4IZ4ZqNSJVepPY+y9Rz2LjRyS5JE');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
