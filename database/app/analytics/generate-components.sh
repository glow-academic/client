#!/bin/bash

echo "🔧 Generating analytics components and SQL..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the Node.js script to generate components
if node "$SCRIPT_DIR/generate-components.js"; then
    echo "✅ Analytics components generated successfully"
else
    echo "❌ Failed to generate analytics components"
    exit 1
fi
