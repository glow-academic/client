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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '4sY4mRFseEC95rW7nTmBvy1N9Vg7+OiLMwd87T/d+5yvxUyAF6MPuqYZI/yTMKA61MlME9KwRSMEt9/htR1SQL9t1HIsgw8+2YWLCmJoU1GZVO7LL0O1FYaH4Zf90CT5ihpZpNY61NR3086h3ygeVq51WG6sOuSSiICYAPkyYoGeakHvIgyjCyUC21aPxDXhoCIeor39xP8pNg5EytlQMd5Uyk8tEhwB35RJZQwUomsAdnxImhCkCIGosuIl4WP0S9FhuTGG75VJGbTTlwxX6CRg2Rxup/II7rzYHWo9Ia0='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'p37NOT/MLtPXk0JMGSUGSaCU2O3FMnqI/HlTmSxbgO40pr9jbVnKh6odY0a7EumSQDnl/hk4hnf/EYtkzgoehkCiFJNa0xI4lBUeUFaPzn61/fORg3GvsrLV4KXzHyfh');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
