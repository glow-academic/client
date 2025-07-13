# scripts/wait-for-services.sh  (commit this at repo-root)

#!/usr/bin/env bash
set -euo pipefail

echo "⏳ Waiting for $* …"
# shellcheck disable=SC2048
for url in $*; do
  until curl -fsS --max-time 2 "$url" >/dev/null; do sleep 2; done
  echo "✅  $url is up"
done

echo "🏃‍♂️  Running Cypress"
exec npx cypress run
