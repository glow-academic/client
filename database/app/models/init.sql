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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'YLm3aDUr1d80zFEPfBY0h8v7zMeJDKw6j1mXeL+N5MzljnVwpz92wPr/GLsW2YZ81zGhcRiBuX+uP5c0Tyb97XwcS3dS7DHY1v582RAMufOW+f372ql9LRdnX/WEie24vDczdQPxSXfWO9OSPU7//VzCjtD3GrAZJDw2JFSdmv6Raue1shnVynfUVN0JQSvAN12eNKyE53mgkvgfZyrVLLD9ql250Hl9p5nv2HMyY0vdnehX05V/Tpl1mSnbFPES5nZ0H0IGfQsEg/CIZsuqff4vkTnK91FxlhmjW2/sHLs='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'dwzPWw+eBF0E235fO32wMMbJ0S0hKHBIZVC/bfmTQ6FHGjs+B2E/eOBMTpUPlrA/CY6QfnqSiyrtQ2IS/g+4UO3rp0k0WfovOHIFO6z/y6EljWl5OWX7Nars+ZcWUFwv');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
