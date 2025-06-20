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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'XO/vQp1ZJqFUQWwicl6SHhtGf09kmm86bq8ym6OKu09fnhsVn3rh2IFPzz6nGjSToukTloJ4yhEsjfffthq3+b29e9T4FvC7Yi0/piJbAjT44l4B+TMMSdulq+HGInV/wbiy6Yc/R2ItwWlxxZpHl591BQm+aBqDRoGmPgMY6q3qU3qJON5knNjdeWYpJBxfFXEUb3fzElpr3RjGmKfmwKw3+YCdvxrzohF7C1s7nfu3t8xjSjvWs2PO8cRi2R9u7rpW9zQtiaE1smlfj5Xwt9Lc0qgWXdUmT3gluqAF5Ew='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'CroOUjIKPeSjJKQ+wS5ZrWAUW12iZkoX6xID//B1Avy620hSTkdIsIm6cNo64D7JoDDk0XAen7wHig631WAdivSScf39iQUPeLZj+VYnaASJSK+M6PlMX+GDXKSqAmjq');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
