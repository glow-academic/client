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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '5ijAtz6G2uFv8Gh0+qaZIFxIb2VPFOurK3hCV+NAq3EuHtHKS6aka7zUDqKezJ/lymYz9MfngnY1jLhwbvvL4+8LEQwK0fJUoAuIAT8bsey+3RZLF9pyPPjCNAqyXiSxUbcFPYabsRpZPFwP5FgYKpi3rcPleNtayDgVT0sJcZtcyU7IDczITDfnQ7/SJA/3qqj9GJ33XPm4prKZ93rMNM0gLGd0EOmSUAjwwZEdpqFdNjD9fMd6ZCpUD5kqZY6wZyEBZJrn3EK1Om28wBqBb+UC9LeayjU4jQ/0e8Obijw='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'vWXs2XG0lKZIHWvQcgEHAyqGEy2ORJaLi+vB2ui62FzGhc39wuLB2LG4JaoD2tm6yP+2ym1CmCmnFc6t0SOoq8Y0LPhqL8MBGMni4j8WFfaxVlrW6Z+Yhg4GPrIfefwq');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
