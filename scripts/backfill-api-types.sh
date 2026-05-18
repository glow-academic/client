#!/bin/bash
# Backfill API types for all existing releases that have openapi.json.
#
# Usage:
#   ./scripts/backfill-api-types.sh          # All releases with openapi.json
#   ./scripts/backfill-api-types.sh v0.1.0   # Specific version

set -e

REPO="glow-academic/api"
API_DIR="api"

mkdir -p "$API_DIR"

if [ -n "$1" ]; then
  VERSIONS="$1"
else
  VERSIONS=$(gh release list --repo "$REPO" --limit 100 --json tagName -q '.[].tagName')
fi

SYNCED=0
SKIPPED=0

for VERSION in $VERSIONS; do
  TS_FILE="$API_DIR/$VERSION.ts"

  if [ -f "$TS_FILE" ]; then
    echo "Skip: $VERSION (already exists)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if ! gh release download "$VERSION" --repo "$REPO" --pattern openapi.json --dir /tmp --clobber 2>/dev/null; then
    echo "Skip: $VERSION (no openapi.json asset)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "Generating: $VERSION..."
  npx openapi-typescript /tmp/openapi.json -o "$TS_FILE" 2>/dev/null
  rm -f /tmp/openapi.json
  SYNCED=$((SYNCED + 1))
done

echo ""
echo "Synced: $SYNCED, Skipped: $SKIPPED"

if [ "$SYNCED" -gt 0 ]; then
  echo ""
  echo "Now regenerate the barrel file and commit:"
  echo "  node scripts/generate-api-index.cjs"
  echo "  git add api/ && git commit -m 'chore: backfill api types'"
fi
