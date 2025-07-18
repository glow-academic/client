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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'ANTNARk+yt/KGNRs4FvghIx4JB50aFIhLlWPJsljscou/EGFHrfNyFzk9j6G52zD+sB6r7h/ZAv6QxXb2Lwia/g1XJ8ICMvZ+bP9cJ2YT7fx7X5GpahpnmOZy4adI320RH5njEJNjQwOBDbbvUC3MIQJCRWMMAJeMp8BPkZhEFeILiUYRvqyVsPzes5ZJIINpYXrVpV2eCpswzJznSx30Oljs748zAaJ+visjXf27mLqZazIHXUrFxMcKuhgEUK+SyK3VYzDMH0676fUhPiSItw+9GMcBBJH5dfkF7e1q8w='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '4gd9P0wp7lmBqalxjxsjFLvDGRmTlQx+5WMOaO1fA4/xWbB9NfRaYORcjPiH+YXJ2W4mcivmvPcWzML5JIdYSREtBvowaxBdbtxPS2cvE+xc4Mzu7LZmEU6jamDBIter');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
