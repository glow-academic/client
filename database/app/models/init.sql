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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '8oeMObdgitgTosslUITKsY9VND2AI+OJl6yK/lxxJSzZnws4WMVlWMV9IezQFkNUst1ymtU53aH5+izvzTBLygteCU/mqg8j8+yAH4/9X9i3v6YHR7uyFhinI5r3JUTkngh9MKjOMu6jchuFEMO46e0qKUJxF4Ji7SkIiUuVZ5PwrpcRy977G1U8S/UQTjd5K3IAdevc5kOCTDs6+eAgPx7KfDFNRM3j5ZuXf7Gkuj0qaHQCH43TM1A1zBTevXVOlVulSembaZ1ghAISH+mz6S3+6A/vEpSVHxwZffBCIic='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'ahEp2eUvhbNPURR3+H4WfJqzC/rGpxrwt8CsR6HM9JFkAKRBVsJNYZel4brFviVXAc0vLfjLfQhtU+x8b5rvl/hPId0Fa19mmqZ2hzuKwuo9hyuE+oRryqoFT+3DXT+8');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
