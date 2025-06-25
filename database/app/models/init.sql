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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'nw6TondFR30k4CnHbVS1rNAj5QmpbB3NGZuyW+61SouP8rDrN/v1XlKdW73w522rQoL+1ogQIzCgLF4mUsxwyDImbtO2h8Wbk7ue7xBGQVGomSVmU/EmF4TcFcRB1/yJBwfGYIyj4nEU4StXQ1sLz1EAG2rQc9CxxPMjRy2CX/tJ8QG9/6+FKB6fe4BV8znqRFFjObZuq4lOzLsZ0WI+D1Qwsg398Xn1tlL8E312BQNeuvSREddHwJLif6W3RkSL4WVdnVEJRfAbYr+Nizcgus7RDBWTUgus9tPoiS5Vnvo='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'mkHroIdMg4JGMT1pAOmh2T3NsWYYfGBsZzjUGlFeLncDe2JglOOYQeGuPqlBogUlcK9mYcrQ1nLZGbfM5FLlfeYnjAhb8dOBYp9lmjCjMxHOL+IJMWfeV8bbj7CCrMq7');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
