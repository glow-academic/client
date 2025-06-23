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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'KZXC1Gu8o6elq53IQxOw18i5GsBtNJ1y6CltEKqBwrBgr7pjyxHtMmGFGBWjb3EgUGCQB5kIR90Z9RTg4AFQMWn1FBhxVyqSGxEb35mqG4GLqLo86ko/aYv9YabHO24imAY2DF4ZOoO6riKa0T9D0P10EpdtbSB0jEJPaCgTt1nQZtE1uHpQ04NAo6l3Gjin/ydeJmERoU+1ceEJSx50Fb06HBs0vEJR4miCGIvfXH842x9b5ZF56wSbRj76O8fC5frRnRjjDhA6TU9W86bJNGagjd+GU0QDKnCDI7UTzv4='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'YMbBJK0VZ2+IYBOc6ea3LuhIfS6cgX5wd0+YAnnLaepU7jIKrco+daACTqecxYfDUV/ldQEyz4wWinptt/mhS03L/h1UiAweV9qdoiUwxkV1Y4G6kwLGrVz6DM9p1eiI');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
