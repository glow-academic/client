#!/bin/bash

# Read markdown files and escape single quotes for SQL
AGGRESSIVE_PROMPT=$(cat "$(dirname "$0")/prompts/aggresive.md" | sed "s/'/''/g")
CONFUSED_PROMPT=$(cat "$(dirname "$0")/prompts/confused.md" | sed "s/'/''/g")
GTA_PROMPT=$(cat "$(dirname "$0")/prompts/gta.md" | sed "s/'/''/g")
HAPPY_PROMPT=$(cat "$(dirname "$0")/prompts/happy.md" | sed "s/'/''/g")
ASSISTANT_PROMPT=$(cat "$(dirname "$0")/prompts/assistant.md" | sed "s/'/''/g")
GRADE_PROMPT=$(cat "$(dirname "$0")/prompts/grade.md" | sed "s/'/''/g")
EVALUATE_PROMPT=$(cat "$(dirname "$0")/prompts/evaluate.md" | sed "s/'/''/g")
SCENARIO_PROMPT=$(cat "$(dirname "$0")/prompts/scenario.md" | sed "s/'/''/g")
CLASSIFY_PROMPT=$(cat "$(dirname "$0")/prompts/classify.md" | sed "s/'/''/g")
COURSE_PROMPT=$(cat "$(dirname "$0")/prompts/course.md" | sed "s/'/''/g")
TITLE_PROMPT=$(cat "$(dirname "$0")/prompts/title.md" | sed "s/'/''/g")

# Generate the SQL file
cat > "$(dirname "$0")/init.sql" << EOF
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE reasoning_effort AS ENUM ('low', 'medium', 'high');

CREATE TABLE agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  system_prompt     TEXT        NOT NULL,
  temperature  INTEGER     NOT NULL, -- 0-100
  default_agent      BOOLEAN     NOT NULL DEFAULT FALSE,
  editable BOOLEAN NOT NULL DEFAULT FALSE, -- For internal models, these are not editable
  model_id UUID REFERENCES models(id),
  reasoning reasoning_effort DEFAULT NULL
);

-- Insert Core Student Agents (Essential for testing)
INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Aggressive','Pushes back on your ideas and challenges assumptions.', '$AGGRESSIVE_PROMPT', 0, true, true, '33333333-cccc-cccc-cccc-333333333333', 'low'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'Happy', 'Provides uplifting feedback and cheerful responses.', '$HAPPY_PROMPT', 0, true, true, '33333333-cccc-cccc-cccc-333333333333', 'low'),
  ('33333333-cccc-cccc-cccc-333333333333', 'Confused', 'Seeks to understand by asking questions and exploring ideas', '$CONFUSED_PROMPT', 0, true, true, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Graduate Level Teaching Assistant Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('44444444-dddd-dddd-dddd-444444444444', 'Graduate Level Teaching Assistant', 'A Graduate Level Teaching Assistant that is able to help a student with their questions and concerns.', '$GTA_PROMPT', 0, true, true, '33333333-cccc-cccc-cccc-333333333333', 'low');


  -- These agents cannot be edited

  -- Insert Assistant Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('55555555-eeee-eeee-eeee-555555555555', 'Assistant', 'A helpful assistant that can help with a variety of tasks.', '$ASSISTANT_PROMPT', 0, true, false, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Grade Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('66666666-ffff-ffff-ffff-666666666666', 'Grade', 'A helpful assistant that can help with a variety of tasks.', '$GRADE_PROMPT', 0, true, false, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Evaluate Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('77777777-7777-7777-7777-777777777777', 'Evaluate', 'A helpful assistant that can help with a variety of tasks.', '$EVALUATE_PROMPT', 0, true, false, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Scenario Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('88888888-8888-8888-8888-888888888888', 'Scenario', 'A helpful assistant that can help with a variety of tasks.', '$SCENARIO_PROMPT', 0, true, false, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Classify Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('99999999-9999-9999-9999-999999999999', 'Classify', 'A helpful assistant that can help with a variety of tasks.', '$CLASSIFY_PROMPT', 0, true, false, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Course Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Course', 'A helpful assistant that can help with a variety of tasks.', '$COURSE_PROMPT', 0, true, false, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Title Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, default_agent, editable, model_id, reasoning) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Title', 'A helpful assistant that can help with a variety of tasks.', '$TITLE_PROMPT', 0, true, false, '33333333-cccc-cccc-cccc-333333333333', 'low');

EOF

echo "Generated init.sql with prompts from markdown files" 