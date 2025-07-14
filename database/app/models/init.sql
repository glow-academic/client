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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'GM+zvszq7z97Uy9pE4LgdzsXQ1ebOu8fyubBfGahYYcmuAj1rwvo8l+oGgz4yqDINnZ0bzSNdJc1Y34f0X3nWICHCIBoI+ct+NthhJzHP8hKtKhmLr0/fVUTUpWvfRPDX5qAl+M3TRVQeLnRddFldSar3evjdQChQ1O+Zz+6JjebtDQ4kMqt9bwgxN8PWqTfCnIkXmeONZDKUi6AXmHOFy1bRWmjHVoWUHbRgYVcbptiMmnlwYnj6tDvlE4BKTYXxqKGvxJ8mI85FbjRk2J+mGaowp2E/2csTC8zbrkb65U='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '6LF5XBoamkF025puUaETCMjVkTEuuD/oLzDp1OgChbeG4jbo7SvzYXzXYsaTSdDTk+4xQMCvzUlApfskNvI6I+jZ5IqVdfQrr3BW+D0svBSm6Or8ZfZ9nX1YDPHWooFc');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
