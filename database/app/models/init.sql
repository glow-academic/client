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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'p0doGfeD9y5IOiaQ3PP4D8EmgLjluZQkK+RoYubsT96tBuSL7ie6hzS7/nU5P+oxHRXbZO98YUEsQgIZniXneGqHMRLxeXLzK6aIsvRZ2JPQn3h1BBGzMqWSa4pqMX65jTc+ccabrV2a+yP7VkEz9BNRELdoRkXjDOK0UyzvBh8lho4rjYwEnOIZ8dNOPXblTAIdkTXHXumjprQdueF7nWi9JuyPH8Yg8zn+DhZxBWn/mAqvsWbywtCKEfR/JQxnX1/AoQZetlqDX5qkr7gOrgJOEeYEWduE7f/PyVda4/Q='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'A/V6ZS+lcXMgzNA8IQAFLEx3fQn6LwtK/c60Nm2MFoUfpziV6zP5Hg9qyoaBc55BAT9cVjMPAbr8N00+IVPqItOgYPjGwDgML/0J5aNqwFSbo4aB4YwlwhJKm9tDAw1Y');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
