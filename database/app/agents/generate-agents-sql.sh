#!/bin/bash

# Read markdown files and escape single quotes for SQL
AGGRESSIVE_PROMPT=$(cat "$(dirname "$0")/prompts/aggresive.md" | sed "s/'/''/g")
CONFUSED_PROMPT=$(cat "$(dirname "$0")/prompts/confused.md" | sed "s/'/''/g")
GTA_PROMPT=$(cat "$(dirname "$0")/prompts/gta.md" | sed "s/'/''/g")
HAPPY_PROMPT=$(cat "$(dirname "$0")/prompts/happy.md" | sed "s/'/''/g")

# Generate the SQL file
cat > "$(dirname "$0")/init.sql" << EOF
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  system_prompt     TEXT        NOT NULL,
  temperature  INTEGER     NOT NULL, -- 0-100
  default      BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Insert Core Agents (Essential for testing)
INSERT INTO agents (id, name, description, system_prompt, temperature, default) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Aggressive','Pushes back on your ideas and challenges assumptions.', '$AGGRESSIVE_PROMPT', 0, true),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'Happy', 'Provides uplifting feedback and cheerful responses.', '$HAPPY_PROMPT', 0, true),
  ('33333333-cccc-cccc-cccc-333333333333', 'Confused', 'Seeks to understand by asking questions and exploring ideas', '$CONFUSED_PROMPT', 0, true),
  ('44444444-dddd-dddd-dddd-444444444444', 'Graduate Level Teaching Assistant', 'A Graduate Level Teaching Assistant that is able to help a student with their questions and concerns.', '$GTA_PROMPT', 0, true);
EOF

echo "Generated init.sql with prompts from markdown files" 