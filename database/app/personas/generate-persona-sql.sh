#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read markdown files and escape single quotes for SQL
AGGRESSIVE_PROMPT=$(cat "$(dirname "$0")/prompts/aggresive.md" | sed "s/'/''/g")
CONFUSED_PROMPT=$(cat "$(dirname "$0")/prompts/confused.md" | sed "s/'/''/g")
HAPPY_PROMPT=$(cat "$(dirname "$0")/prompts/happy.md" | sed "s/'/''/g")
PASSIVE_PROMPT=$(cat "$(dirname "$0")/prompts/passive.md" | sed "s/'/''/g")

# Resolve target path to database/seed/cs/agents.sql
TARGET_DIR="$SCRIPT_DIR/../../seed/cs"
mkdir -p "$TARGET_DIR"
TARGET_FILE="$TARGET_DIR/personas.sql"

# Write ONLY insert statements
cat > "$TARGET_FILE" << EOF
-- Insert Core Student Agents (Essential for testing)
INSERT INTO personas (id, name, description, system_prompt, temperature, default_persona, color, icon, model_id, reasoning, active, department_id) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Aggressive','Pushes back on your ideas and challenges assumptions.', '$AGGRESSIVE_PROMPT', 0.0, true, '#ef4444', 'Zap', '33333333-cccc-cccc-cccc-333333333333', 'low', true, '33333333-3333-3333-3333-333333333333'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'Happy', 'Provides uplifting feedback and cheerful responses.', '$HAPPY_PROMPT', 0.0, true, '#22c55e', 'SmilePlus', '33333333-cccc-cccc-cccc-333333333333', 'low', true, '33333333-3333-3333-3333-333333333333'),
  ('33333333-cccc-cccc-cccc-333333333333', 'Confused', 'Seeks to understand by asking questions and exploring ideas', '$CONFUSED_PROMPT', 0.0, true, '#eab308', 'HelpCircle', '33333333-cccc-cccc-cccc-333333333333', 'low', true, '33333333-3333-3333-3333-333333333333'),
  ('44444444-dddd-dddd-dddd-444444444444', 'Passive', 'Low engagement and a tendency to avoid conflict or assertiveness.', '$PASSIVE_PROMPT', 0.0, true, '#06b6d4', 'Cloud', '33333333-cccc-cccc-cccc-333333333333', 'low', true, '33333333-3333-3333-3333-333333333333');

EOF

echo "Generated personas.sql with prompts from markdown files"
