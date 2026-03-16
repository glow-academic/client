#!/bin/bash
# Start target environment container and wait for health check.
#
# Usage:
#   ./scripts/deploy-target.sh <blue|green>
#   TIMEOUT=600 ./scripts/deploy-target.sh green

set -e

TARGET_ENV="${1:?Usage: $0 <blue|green>}"
MAX_WAIT="${TIMEOUT:-120}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${script_dir}/.."

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

echo "Deploying app-$TARGET_ENV..."

docker compose up -d "app-$TARGET_ENV"
sleep 5

echo "Waiting for app-$TARGET_ENV to be healthy..."
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  HEALTH=$(docker compose ps "app-$TARGET_ENV" --format json 2>/dev/null | jq -r '.Health // "unknown"' || echo "unknown")

  if [ "$HEALTH" = "healthy" ]; then
    echo "app-$TARGET_ENV is healthy"
    exit 0
  fi

  echo "Waiting... (${ELAPSED}s/${MAX_WAIT}s)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo "app-$TARGET_ENV failed health checks after ${MAX_WAIT}s"
exit 1
