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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 's6/uAgGHC4xwdptugIFGB4+P39Pw+7zRG8ZaKAw0yq34f8Kn6zDlvlIKbLMjhAzhvbZQLLdgKKIjdFm8o3Dnl+OyKMW7W0RTgIkIi5iBASrrv+0rvq9ZXzfukILAY4nyUOjZCYD+yhKiGBpIkLcC9juiEESAEB9E18zmXQFmoSLOcKvwaIcjOkUINSXeLMbOk1anWJHJvu9YYeIGPuXqG1ax7IcWVRZ422152FlvY+M9GyHJSdwN1chkq1yHX0pXDEldCEdVFSfAKM6sjPg1LS0sK6lYcWdnGFwp0mFOLXw='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'OfN7PJa/6d7P7yUpMIICbyyDHFFG2OsRXnqEsIV+/HP5cOejg9hKVvPxxmLixt1S19FR4q8mQLkZAa2QsQoXhD4x9GOQ/O6iCRjUikh/Ze3yybhdtGFdgWFtHbCJ7myr');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
