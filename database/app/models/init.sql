-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE model_type AS ENUM ('ttt', 'tts', 'stt'); -- ttt: text to text, tts: text to speech, stt: speech to text

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
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  model_type model_type  NOT NULL DEFAULT 'ttt'
);

-- Insert providers with properly encrypted API keys
INSERT INTO providers (id, name, description, api_key) VALUES 
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'iqYIDnLKuqRfvnAmkDv3ysnXnlOjb6GuoEtPQ4qGIGXxHOAnQVmhH2pm5TCnRqpeYDO19zP6wRxyHFqImyQBllGKnj8t68Fvc+8RDOuD9W1UC1tePA402vWcIBM8sIP7RX1Fin8HYx7vSl5/nb4AqF/inhlsE4+n7fMHEqosHQOaPYJPKFPtYaIAuDMBQ9bEsvY/Kqzuk2udZfFfXhPb7wEPlzlVuojLA2DS8dnf0bdXyn1w8UjkHOe5Lqx3+wNIgjg/qPrn0hgbpFm4OahEOtgfyvsbqZCpkq7DhFwIohE='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'lqACjihHTFOpRMylpzA9sr9WSZHPd+MVkvqBdSyLDTNxdhmTHzElvF5HGWErerlRNegGIILbDaPftZ/z+IC03ta8Cu11qjrpCtswwnoPGrxdbQQcYjagiokdcvp9I4Ph');

INSERT INTO models (id, name, description, provider_id, model_type) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111', 'ttt'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333', 'ttt'),
('44444444-dddd-dddd-dddd-444444444444', 'gpt-4o-mini-tts', 'GPT-4o Mini TTS is a text to speech model that can be used to generate audio.', '11111111-aaaa-aaaa-aaaa-111111111111', 'tts'),
('22222222-bbbb-bbbb-bbbb-222222222222', 'gemini-2.5-flash-preview-tts', 'Gemini 2.5 Flash TTS is a text to speech model that can be used to generate audio.', '33333333-cccc-cccc-cccc-333333333333', 'tts'),
('55555555-eeee-eeee-eeee-555555555555', 'gpt-4o-mini-transcribe', 'GPT-4o Mini Transcribe is a speech to text model that can be used to transcribe audio.', '11111111-aaaa-aaaa-aaaa-111111111111', 'stt');
