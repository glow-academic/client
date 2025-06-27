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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'SBPqtB9wYDcG7J9g/yBBTRonfEmhj5RXTmxup91v6OEfKbovVwAZhlNnsLfohp1QQT+tEtQA/jB8HlMmkoT+tYasBA7CQ1YZu/yIulz8nnz44W6thxb+W1BQKFe80MrCCfsMzV8zTy3CewurSFOMt/k23IFoWqbyDeHKGV+zD0gy1oOFwY2Aq9KhxMfd0fDS0h+Qh1rt/cYko5dHvz3c8IP1O1bNUtzaMXhWVKb5LWr3DYZk8JwJyZKraDxNT+X5sSy/u8cGY6Um0NkFpQnzRncJF07YPT2QanN2Tz/8czY='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'WCFXIXvNWcuOR/7r9XKketTa+PXd5EJVcBb6ugnn3/GLolSKIqj7dOT8qROJg/Xr6yKi54u/zCdLYz4gR3YKoaAXZ6D+vS/NsHGW56ZU9LXLw9gvwbn6HR4fg06+TTzd');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
