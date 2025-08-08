#!/bin/bash

# Check if required environment variables are set
if [[ -z "$SECRET_KEY" ]]; then
  echo "ERROR: SECRET_KEY environment variable is not set"
  exit 1
fi

if [[ -z "$OPENAI_API_KEY" ]]; then
  echo "ERROR: OPENAI_API_KEY environment variable is not set"
  exit 1
fi

if [[ -z "$GEMINI_API_KEY" ]]; then
  echo "ERROR: GEMINI_API_KEY environment variable is not set"
  exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"

# Run the encryption script and capture the output
if ! ENCRYPTED_KEYS=$(node "$SCRIPT_DIR/encrypt-keys.js" 2>/dev/null); then
  echo "ERROR: Failed to encrypt API keys"
  exit 1
fi

# Parse the encrypted keys
eval "$ENCRYPTED_KEYS"

if [[ -z "$ENCRYPTED_OPENAI_KEY" ]] || [[ -z "$ENCRYPTED_GOOGLE_KEY" ]]; then
  echo "ERROR: Failed to get encrypted keys"
  exit 1
fi

# Resolve target path to database/seed/default/models.sql
TARGET_DIR=$(cd "$SCRIPT_DIR/../../seed/default" && pwd)
mkdir -p "$TARGET_DIR"
TARGET_FILE="$TARGET_DIR/models.sql"

# Write ONLY insert statements
cat > "$TARGET_FILE" << EOF
-- Insert providers with properly encrypted API keys
INSERT INTO providers (id, name, description, api_key) VALUES 
('11111111-aaaa-aaaa-aaaa-111111111111', 'openai', 'OpenAI', '$ENCRYPTED_OPENAI_KEY'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini', 'Google', '$ENCRYPTED_GOOGLE_KEY');

-- Insert models
INSERT INTO models (id, name, description, provider_id) VALUES
('11111111-aaaa-aaaa-aaaa-111111111111', 'gpt-4o', 'GPT-4o is a language model that can be used to generate text, images, and audio.', '11111111-aaaa-aaaa-aaaa-111111111111'),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio.', '33333333-cccc-cccc-cccc-333333333333');
EOF

echo "Wrote model/provider inserts to $TARGET_FILE"