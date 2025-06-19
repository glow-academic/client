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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'dUUc7bqCMA1KDlo1hTt2aetbbTlcInroYIui+1PzM+d69/sJhOS3t0QDhn99PjdL0dKSZT94GYKd1D8ofLEdhJS2bSR0wj4DzUEpm/4HoKo16wDwbSv9RAs/B4GkKf9iJcqWfHaN8NYZz5H2tKZH/riVnPJOZ6LmQyMOYXGAaASyncVMCd70QB+hEGFGPfexU6QAkcQbeU6cGrt8CVv8in4M1WxlthFEr6qGdFiwp5zPZ8clRv0uf4iRvjo8qDYDlkGSaJs4onJSBsqlBjSMxD/1NRnEtzH4pGCLpHBT2BA='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'qivhWlZxxIXrp+RcUnTwfL687GNnOo3+/WaY0OkfPSx3jQbF792vHOg/LoHdGzxItE2XoeS9osviZyd0UBVhjwH5mHqYqhTR5LVEBy5IO9omfBNg2XfzBfTm+slp7YPD');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
