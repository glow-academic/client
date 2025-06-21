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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'l643X10h90C1Sfk3MzF5rnZjAflrxYJg+f9TSeyRDxwpmHHTi5/GaV/dOGwypiMUGVOKj1JTrUggVZEn3eMTslr0In282QpMu3nISRE/JA9td7778gmgrnIy992mHy5pTzA2G+4txQ7hjO0OELL8X+01ezqDUuu7tj2/NlMZbJM7LRDgeIoelw5SzwZflq8AGmV7fpVKICWYtm7P2EQgsJnYzESmJpa420vCcfCU6sbwfO9jJu++lS1PMnmHE6sc15B+jP7XU8WaqsGUbc9EsP5uDcTOfv1Acil1xL6SN/M='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '/8Aa0B4yPoLrDjBu4PsCjs6J0YMKfnlJIzFLTEqAm778Ma/ui5LaXlcO5pNpSHhba791rqKRPb+KcGH3ijlOODS80Cjb++L8VUQD/XLUp016wVbGZJOH9isXCviJAxXq');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
