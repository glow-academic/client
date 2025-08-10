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

-- Insert models with current pricing (August 2025)
-- Pricing per 1 million tokens: input_ppm (input price), output_ppm (output price)
INSERT INTO models (id, name, description, provider_id, input_ppm, output_ppm) VALUES
('22222222-bbbb-bbbb-bbbb-222222222222', 'gpt5', 'GPT-5 is OpenAI''s latest language model with advanced reasoning and multimodal capabilities.', '11111111-aaaa-aaaa-aaaa-111111111111', 1.25, 10.00),
('44444444-dddd-dddd-dddd-444444444444', 'gpt5-mini', 'GPT-5 Mini is a faster, more efficient version of GPT-5 optimized for speed and cost.', '11111111-aaaa-aaaa-aaaa-111111111111', 0.25, 2.00),
('55555555-eeee-eeee-eeee-555555555555', 'gpt5-nano', 'GPT-5 Nano is the smallest and fastest GPT-5 variant, ideal for real-time applications.', '11111111-aaaa-aaaa-aaaa-111111111111', 0.05, 0.40),
('33333333-cccc-cccc-cccc-333333333333', 'gemini-2.5-flash', 'Gemini 2.5 Flash is a language model that can be used to generate text, images, and audio. Pricing shown is for thinking mode.', '33333333-cccc-cccc-cccc-333333333333', 0.15, 3.50),
('66666666-ffff-ffff-ffff-666666666666', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite is a lightweight version of Gemini 2.5 Flash optimized for speed and efficiency.', '33333333-cccc-cccc-cccc-333333333333', 0.10, 0.40),
('77777777-aaaa-aaaa-aaaa-777777777777', 'gemini-2.5-pro', 'Gemini 2.5 Pro is Google''s most advanced language model with enhanced reasoning and multimodal capabilities. Pricing shown is for context windows ≤200k tokens.', '33333333-cccc-cccc-cccc-333333333333', 1.25, 10.00);
EOF

echo "Wrote model/provider inserts to $TARGET_FILE"