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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'hJ0LFjp3yd5noKuV9/dH6MNqP5MKbSHIPJ9XJP9Kl/BcQpHCDtvx1sg2EZkEivrkpGsdKGx8DaI2bvuaU5IzpCQgUZfQGwGNkLZCJSc36VwpP3qzsSGJTq1M9rPOOflWTZ3obSmjjMrqJhUhOIXpf1kQ4p0t8gGM1j3/WdwfvLLyLW7FKbe5oHcgQrAVfdTz/y1l/gs0vXTTdsD1EgNw8zJV7skJYfPH3dBYUtSrTfVThkkw0kJpxGG7io43Cqaz3gKdlCvmCV47kM4n2bsdr94zutNhO/08Hei9Oora1M4='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'BAEw04j/8WQG4G5GAJ0wtdJybcXgMAblGWBdxrHsQi2rX67yw4uAgT7lJfHiofVk1UHBAau3bzbXdvay91cyfU7J3VfQS3mymeu88yjkHSO9mP/T7kM4X6WxeWXppuYT');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
