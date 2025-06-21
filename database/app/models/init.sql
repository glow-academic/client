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
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', 'eQ2MeljuHTNHSEYrZzaAt7so7AHOGj4phFafb/bCArXBjQlsHmuqAdny+yQB8VDNDlp4/LxNJTUHDAzDLGWL39xt+Al3juVFg+8CTfg7DXlZlJCM/MyNBhQHTjyKX5lXcCCIZchifvWoITC/RqXQ35fbc3xI67hziSMsojcNwLTbYOwQmsgxymHIOMovD5NXC+ZcNNrMDfxvcDS5DKZXoqjXbzW8eUKM87ApuXQxTd6f7n3cQJxUJ4AvzDzVZ8v3q+O33Y+yvNm3fK9rZXS969EW6AXbXw7VapGLUMsqI4Y='),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', 'x/9hHtS91GxDuyf4jDcPrvhseVXDNu0+28knWbvY0dPG/9m+4pXbYp+dm7VYqKEfPavbjsS7WF1ttFcPy93hJmBEdDddeCXRkyfwCQpMerZoqh4VvN37rqGcUpnqyrck');

INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
