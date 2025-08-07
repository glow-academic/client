#!/bin/bash

# Read markdown files and escape single quotes for SQL
AGGRESSIVE_PROMPT=$(cat "$(dirname "$0")/prompts/aggresive.md" | sed "s/'/''/g")
CONFUSED_PROMPT=$(cat "$(dirname "$0")/prompts/confused.md" | sed "s/'/''/g")
HAPPY_PROMPT=$(cat "$(dirname "$0")/prompts/happy.md" | sed "s/'/''/g")
ASSISTANT_PROMPT=$(cat "$(dirname "$0")/prompts/assistant.md" | sed "s/'/''/g")
GRADE_PROMPT=$(cat "$(dirname "$0")/prompts/grade.md" | sed "s/'/''/g")
EVALUATE_PROMPT=$(cat "$(dirname "$0")/prompts/evaluate.md" | sed "s/'/''/g")
SCENARIO_PROMPT=$(cat "$(dirname "$0")/prompts/scenario.md" | sed "s/'/''/g")
CLASSIFY_PROMPT=$(cat "$(dirname "$0")/prompts/classify.md" | sed "s/'/''/g")
TITLE_PROMPT=$(cat "$(dirname "$0")/prompts/title.md" | sed "s/'/''/g")

# Generate the SQL file
cat > "$(dirname "$0")/init.sql" << EOF
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE reasoning_effort AS ENUM ('low', 'medium', 'high');

CREATE TABLE personas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  system_prompt     TEXT        NOT NULL,
  temperature  REAL     NOT NULL, -- 0.0-1.0
  default_persona      BOOLEAN     NOT NULL DEFAULT FALSE,
  color TEXT        NOT NULL, -- hex color code
  icon TEXT        NOT NULL, -- icon name, in Lucide Icons
  model_id UUID REFERENCES models(id),
  reasoning reasoning_effort DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  system_prompt     TEXT        NOT NULL,
  temperature  REAL     NOT NULL, -- 0.0-1.0
  model_id UUID REFERENCES models(id),
  reasoning reasoning_effort DEFAULT NULL
);
-- Insert Core Student Agents (Essential for testing)
INSERT INTO personas (id, name, description, system_prompt, temperature, default_persona, color, icon, model_id, reasoning, active) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Aggressive','Pushes back on your ideas and challenges assumptions.', '$AGGRESSIVE_PROMPT', 0.0, true, '#ef4444', 'Zap', '33333333-cccc-cccc-cccc-333333333333', 'low', true),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'Happy', 'Provides uplifting feedback and cheerful responses.', '$HAPPY_PROMPT', 0.0, true, '#22c55e', 'SmilePlus', '33333333-cccc-cccc-cccc-333333333333', 'low', true),
  ('33333333-cccc-cccc-cccc-333333333333', 'Confused', 'Seeks to understand by asking questions and exploring ideas', '$CONFUSED_PROMPT', 0.0, true, '#eab308', 'HelpCircle', '33333333-cccc-cccc-cccc-333333333333', 'low', true);


  -- These agents cannot be edited

  -- Insert Assistant Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('55555555-eeee-eeee-eeee-555555555555', 'Assistant', 'A helpful assistant that can help with a variety of tasks.', '$ASSISTANT_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Grade Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('66666666-ffff-ffff-ffff-666666666666', 'Grade', 'A helpful assistant that can help with a variety of tasks.', '$GRADE_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Evaluate Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('77777777-7777-7777-7777-777777777777', 'Evaluate', 'A helpful assistant that can help with a variety of tasks.', '$EVALUATE_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Scenario Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('88888888-8888-8888-8888-888888888888', 'Scenario', 'A helpful assistant that can help with a variety of tasks.', '$SCENARIO_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Classify Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('99999999-9999-9999-9999-999999999999', 'Classify', 'A helpful assistant that can help with a variety of tasks.', '$CLASSIFY_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Title Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Title', 'A helpful assistant that can help with a variety of tasks.', '$TITLE_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

EOF

echo "Generated init.sql with prompts from markdown files" 