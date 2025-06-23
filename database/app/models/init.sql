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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '8+gNgL+PFitgWGP1CDsAsuBGT5CuMhw1ifjDl3hvGeYHELYRQLWhpo6/3HlBvOHsZBNCW/6GVCoEbXxLCOMIhsiwQUnNaS2AIure+qiuimOgVqi/Gi8PNOzcng3rGsIiw4qPRAU+JNKSZLasrk6e/ky9xGCLlCzUkunP7yia6MdFRc/gl/1/mz36XRo9JPr2Ku4+a6XOEifDqDRuMZh+FJ6uttsIdvTijsWj8yOgrxkXifHZnn97K5Ehr/ybuYpTzxhi8zDVmI2Fy5qguLFu3Y/oZN0/50IBL5j1pWx+LWc='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'cDrTwPmUccJYLzU2BXWKOd66EWfI7xUkur1ZYoQpdtfmS/aYNwO8Iv01Pb86zu/YCp2+MAROwFMU0QKCn+KDEX0r1dOjjfoWqKiAb3orC33TB8/IJK7/JYHjHk+GqkHC');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
