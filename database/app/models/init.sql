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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'MNOsftfPFa2SK6oC2cUJbKXTr5fs4hTA8XsaLeNRmf/QYl6TxRmKL3W/N2Ir622ATL7OZz7NwI/xzGI4XKbBuHQK5UpD0NKdhPuuFPEVx6FlPIQuKgRfAz8ytNTUJdJWkEH2snhAb5KYkfdJd1VKZx5N9x8xD87MyeWxSm4wB1DKKXi00rgJundr5hDI8pURLmlEc4ZMBwmzy0DCXyrVUM064OlGhdEksonJ1yMLVyP3RYU/FdMhlWp6TqRDEfmdm+XpZal3VXGGjnVkU6vhR86FR5vqlEc/wRMbZN8vFLw='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '9Z4STCMrxam8AM0WZVwys1HfwLm4yppX2ZcFYXf4iwUf09SVwAhwLQmguoJGb74cTMhBj71x+oXiAF/kyRjJejtXp48/xTII6IMRfrg3cZ7ORWGVsLQ17v3yxGi5V2/f');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
