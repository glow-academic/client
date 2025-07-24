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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '39/cwlOZ9RMGrbqnYUqMEqtB4sMZZzc9Qxoach7RCwo9M2aQlButBreJnd0DldA0dusmaxa56X5n/nIkyK/g8ssbO0y5/2l2a3eB63G9CWy26zmPzMFCGt4eJb+RUXpjWrY3RelbSNj8JzzGrnRhbMPljGgcuTDH8BGVTLjuLDtwlM9gBafbFrrX2xflT9pc2WkeVw+SMopU5pd950oqJx+8KexDpF34EAQ3bNucPwrwTpHbyLnsu0yVQFU5k8y4ZfEocbFKwPmW5sDsqZc9iERfbFwFPpYIsyHYTdFYsRY='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '4mdAM70JBya9TXEKh9S0A8Yp3/Qk9tWd6+5oycYorr/om/oivRNvKNYxJS2kRgeLBMLIJRt+tw81GX3sQjDPfUd/4eNq6Ak7R00VoDdW7+Gh6NJ8F2UUVqv9ZAtyuo70');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
