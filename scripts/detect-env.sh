#!/bin/bash
# Detect active/target environment for blue-green deployment.
# Outputs KEY=VALUE lines suitable for eval or GitHub Actions outputs.
#
# Usage:
#   eval $(./scripts/detect-env.sh)

set -e

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${script_dir}/.."

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

ACTIVE_ENV="${ACTIVE_ENV:-blue}"
if [ "$ACTIVE_ENV" = "green" ]; then
  TARGET_ENV="blue"
else
  TARGET_ENV="green"
fi

echo "ACTIVE_ENV=$ACTIVE_ENV"
echo "TARGET_ENV=$TARGET_ENV"
