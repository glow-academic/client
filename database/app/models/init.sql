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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'L2x0QnbZFtIHzZqn0eQeptiVwlfJqIlRxRd4FPU1VE7vCh1zJEmAT6Nq9xVz+4NKzaKY5xm4+0E/in6ry6PjH9zvyySH5hCcXVcaaFSp+gdDN+s4V/Uy34BCtPxLzyunMLMOTr2Vh0KNglxDTAvBjyubc5huTTh3keMkoZ0ytKh4AyxjNL9/yWuUEduLPso2ysItSm8PFbynIvrntO7sjFPoM869EgVF1pEPwj1bRvo0ge/Q318dMlOZtvyIgM3xwilkmeIUSqtRL5bMcnJVHELwm4wQmwDUCKCjEeFpJ4E='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'l7sReqTCN32paVbbmsRoTy3vZNxiIwji92L0Na2eNJPTv1im02zw0yLbLYDvDUt+zyZOXKSsSEfbSYPZpNWRLQcbDGoptkzJa9n4JJOwIJxR6rZALrQHA6OeIUM5U9XT');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
