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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'slqgMjRnL5IDdMoz7xUOUXb4M1KHJxQDDRvidcMg4c2skzbhwUldek9QtF5p4OudQN4Oj3Asegulyw+lIrGvJzKm77ghNZS/l6LwIdUluU3dS6C0s3g2Q7CV5bcqTpFA27ZadW6kDiRJ0P7LpdRrpk35m4IRsmuHgn54BVpCHa9GZV6u9XnIJGhigL1bcFTPCspBGldOdoIOSiEAtHa910BuQ/DFuYVhxP7EbMi1zy2R+HkGFOqIQzOuKPtSDZgkXq4L8pIHWxpZta+cjWHJT6ke6LMIMZVs79C1JC/hf5Q='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'Du/yBJ0bPl/N1xxij4ydnmlTnY6xlL+FrGI0WxPo3zlFzax44jFtNRoydJN7l2K16AuWn4Z56XOCrXPu5IRYpWmmwOdZ5R8WlC0/nA2/ROvFlWpNqFo4OWWwkw2gMuRE');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
