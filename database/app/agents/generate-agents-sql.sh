#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read markdown files and escape single quotes for SQL
ASSISTANT_PROMPT=$(cat "$(dirname "$0")/prompts/assistant.md" | sed "s/'/''/g")
GRADE_PROMPT=$(cat "$(dirname "$0")/prompts/grade.md" | sed "s/'/''/g")
GUARDRAIL_PROMPT=$(cat "$(dirname "$0")/prompts/guardrail.md" | sed "s/'/''/g")
SCENARIO_PROMPT=$(cat "$(dirname "$0")/prompts/scenario.md" | sed "s/'/''/g")
CLASSIFY_PROMPT=$(cat "$(dirname "$0")/prompts/classify.md" | sed "s/'/''/g")
TITLE_PROMPT=$(cat "$(dirname "$0")/prompts/title.md" | sed "s/'/''/g")

# Resolve target path to database/seed/agents.sql
TARGET_DIR="$SCRIPT_DIR/../../seed"
mkdir -p "$TARGET_DIR"
TARGET_FILE="$TARGET_DIR/agents.sql"

# Write ONLY insert statements
cat > "$TARGET_FILE" << EOF
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