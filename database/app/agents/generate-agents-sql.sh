#!/bin/bash

# Read markdown files and escape single quotes for SQL
AGGRESSIVE_PROMPT=$(cat "$(dirname "$0")/prompts/aggresive.md" | sed "s/'/''/g")
CONFUSED_PROMPT=$(cat "$(dirname "$0")/prompts/confused.md" | sed "s/'/''/g")
HAPPY_PROMPT=$(cat "$(dirname "$0")/prompts/happy.md" | sed "s/'/''/g")
PASSIVE_PROMPT=$(cat "$(dirname "$0")/prompts/passive.md" | sed "s/'/''/g")
ASSISTANT_PROMPT=$(cat "$(dirname "$0")/prompts/assistant.md" | sed "s/'/''/g")
GRADE_PROMPT=$(cat "$(dirname "$0")/prompts/grade.md" | sed "s/'/''/g")
GUARDRAIL_PROMPT=$(cat "$(dirname "$0")/prompts/guardrail.md" | sed "s/'/''/g")
SCENARIO_PROMPT=$(cat "$(dirname "$0")/prompts/scenario.md" | sed "s/'/''/g")
CLASSIFY_PROMPT=$(cat "$(dirname "$0")/prompts/classify.md" | sed "s/'/''/g")
TITLE_PROMPT=$(cat "$(dirname "$0")/prompts/title.md" | sed "s/'/''/g")

# Resolve target path to database/seed/default/agents.sql
TARGET_DIR=$(cd "$SCRIPT_DIR/../../seed/default" && pwd)
mkdir -p "$TARGET_DIR"
TARGET_FILE="$TARGET_DIR/agents.sql"

# Write ONLY insert statements
cat > "$TARGET_FILE" << EOF
-- Insert Core Student Agents (Essential for testing)
INSERT INTO personas (id, name, description, system_prompt, temperature, default_persona, color, icon, model_id, reasoning, active) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Aggressive','Pushes back on your ideas and challenges assumptions.', '$AGGRESSIVE_PROMPT', 0.0, true, '#ef4444', 'Zap', '33333333-cccc-cccc-cccc-333333333333', 'low', true),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'Happy', 'Provides uplifting feedback and cheerful responses.', '$HAPPY_PROMPT', 0.0, true, '#22c55e', 'SmilePlus', '33333333-cccc-cccc-cccc-333333333333', 'low', true),
  ('33333333-cccc-cccc-cccc-333333333333', 'Confused', 'Seeks to understand by asking questions and exploring ideas', '$CONFUSED_PROMPT', 0.0, true, '#eab308', 'HelpCircle', '33333333-cccc-cccc-cccc-333333333333', 'low', true),
  ('44444444-dddd-dddd-dddd-444444444444', 'Passive', 'Low engagement and a tendency to avoid conflict or assertiveness.', '$PASSIVE_PROMPT', 0.0, true, '#06b6d4', 'Cloud', '33333333-cccc-cccc-cccc-333333333333', 'low', true);


  -- These agents cannot be edited

  -- Insert Assistant Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('55555555-eeee-eeee-eeee-555555555555', 'Assistant', 'A helpful assistant that can help with a variety of tasks.', '$ASSISTANT_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Grade Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('66666666-ffff-ffff-ffff-666666666666', 'Grade', 'Helps grade rubrics of chat conversations between students and GTAs.', '$GRADE_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Scenario Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('88888888-8888-8888-8888-888888888888', 'Scenario', 'Helps create distinct scenarios for chat interactions.', '$SCENARIO_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Classify Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('99999999-9999-9999-9999-999999999999', 'Classify', 'Helps classify documents into categories.', '$CLASSIFY_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

  -- Insert Title Agent
  INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Title', 'Helps generate titles for chat interactions.', '$TITLE_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

-- Insert Guardrail Agent
INSERT INTO agents (id, name, description, system_prompt, temperature, model_id, reasoning) VALUES
  ('cccccccc-dddd-dddd-dddd-cccccccccccc', 'Guardrail', 'Helps ensure that the chat interactions are appropriate and follow the role of an AI student.', '$GUARDRAIL_PROMPT', 0.0, '33333333-cccc-cccc-cccc-333333333333', 'low');

EOF

echo "Generated agents.sql with prompts from markdown files" 