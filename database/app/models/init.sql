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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'ndWdHj5xvLvnwfU3YwS29ZIswlMKOW0IMacrUB5ROFtrQbX5SlOCPGNnzUNet2nae2TvBlksRw5WuQFQjhi0vQE7t9DvJ3cNt+g5AptKaTkEyllAKPvrM8voi2kPA1iSjXhelzq+ypCrwLyeWqDBq4mLEadx+lak5+4fXwp2WbS9S2877gjgzSlCiJuQr3hF+sd+C9Wg7XyTxyJh09F7AT/pwrd7nwBWVP3kV7VmMI5xcW9TJJ2EpI5KTixLp9RyIZuImTDM8flOgOS6LTrw4JqHghovFr+OgKW1IZIXJUQ='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'yiaYY7vrXUHuqyH6O1OtgNqNaqoyFUQcFUZGwRD5bagzbxfjAORhN7heTY1hEv4Y5aupH+q+FVt7/Uly/e0Cx53VXFjWiuXraF9Q8E8gZQt4AZwl0GER2juIrb6rZtHl');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
