#!/bin/bash
# Monitor deployment with grace period and auto-rollback.
#
# Usage:
#   ./scripts/monitor.sh <target-env> <rollback-env> [grace-seconds]

set -e

TARGET_ENV="${1:?Usage: $0 <target-env> <rollback-env> [grace-seconds]}"
ROLLBACK_ENV="${2:?Usage: $0 <target-env> <rollback-env> [grace-seconds]}"
GRACE_PERIOD="${3:-45}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${script_dir}/.."

echo "Monitoring app-$TARGET_ENV for ${GRACE_PERIOD}s..."

ELAPSED=0
ERROR_COUNT=0

while [ $ELAPSED -lt $GRACE_PERIOD ]; do
  HEALTH=$(docker compose ps "app-$TARGET_ENV" --format json 2>/dev/null | jq -r '.Health // "unknown"' || echo "unknown")

  if [ "$HEALTH" != "healthy" ]; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
    echo "Health check failed (count: $ERROR_COUNT)"

    if [ $ERROR_COUNT -ge 3 ]; then
      echo "Rolling back to $ROLLBACK_ENV..."
      "${script_dir}/switch-traffic.sh" "$ROLLBACK_ENV"
      exit 1
    fi
  else
    ERROR_COUNT=0
  fi

  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "Monitoring... (${ELAPSED}s/${GRACE_PERIOD}s)"
done

echo "Deployment successful, app-$TARGET_ENV is stable"
