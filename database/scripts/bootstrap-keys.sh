#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Bootstrap API Keys
# =============================================================================
# Reads config.yaml, encrypts API keys with SECRET_KEY, and either:
#   - Updates the live database (default)
#   - Appends SQL UPDATE statements to a file (--append mode, for Docker)
#
# Usage:
#   ./bootstrap-keys.sh                              # Update live DB
#   ./bootstrap-keys.sh --config path.yaml           # Specific config
#   ./bootstrap-keys.sh --append seed_modules.sql    # Append SQL to file
#   ./bootstrap-keys.sh --dry-run                    # Show what would be updated
# =============================================================================

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
encrypt_script="$script_dir/encrypt-keys.js"

# --- Parse args ---------------------------------------------------------------
config_file=""
append_file=""
dry_run=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      config_file="$2"
      shift 2
      ;;
    --append)
      append_file="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    *)
      echo "Usage: $0 [--config path.yaml] [--append file.sql] [--dry-run]"
      exit 1
      ;;
  esac
done

# --- Resolve config file ------------------------------------------------------
if [[ -z "$config_file" ]]; then
  config_file="$project_root/config.yaml"
  if [[ ! -f "$config_file" ]]; then
    config_file="$project_root/config.example.yaml"
  fi
fi

if [[ ! -f "$config_file" ]]; then
  echo "WARNING: Config file not found: $config_file - skipping key bootstrap"
  exit 0
fi

# --- Load .env ----------------------------------------------------------------
if [[ -f "$project_root/.env" ]]; then
  set -a
  source "$project_root/.env"
  set +a
fi

SECRET_KEY="${SECRET_KEY:-}"
if [[ -z "$SECRET_KEY" ]]; then
  echo "WARNING: SECRET_KEY not set - skipping key bootstrap"
  exit 0
fi

DB_USER=${DB_USER:-myuser}
DB_PASSWORD=${DB_PASSWORD:-mypassword}
DB_NAME=${DB_NAME:-mydb}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# --- Check Node.js ------------------------------------------------------------
if ! command -v node &>/dev/null; then
  echo "WARNING: Node.js not found - skipping key bootstrap"
  exit 0
fi

if [[ ! -f "$encrypt_script" ]]; then
  echo "WARNING: encrypt-keys.js not found at $encrypt_script - skipping key bootstrap"
  exit 0
fi

# --- YAML reader (same approach as load-modules.sh) ---------------------------
read_yaml() {
  local file=$1
  local path=$2
  if command -v yq &>/dev/null; then
    yq -r "$path // empty" "$file" 2>/dev/null || true
  else
    python3 -c "
import yaml, sys
with open('$file') as f:
    data = yaml.safe_load(f)
path = '$path'.lstrip('.')
parts = [p for p in path.split('.') if p]
val = data
for p in parts:
    if val is None: sys.exit(0)
    val = val.get(p) if isinstance(val, dict) else None
if val is None:
    sys.exit(0)
print(val)
" 2>/dev/null || true
  fi
}

# --- Key mapping --------------------------------------------------------------
# Format: yaml_path|keys_resource_id|provider_keys_resource_id|display_name
# provider_keys_resource_id is empty for auth keys (they only live in keys_resource)
KEYS=(
  "providers.openai_api_key|019bbdcb-6d52-7889-8484-ed84e9180139|019c441a-0eb9-7665-a01c-a6fec156d716|OpenAI API Key"
  "providers.gemini_api_key|019bbdcb-6d52-7d32-803f-3f5c8c2a9af7|019c441a-0eb9-7938-8d65-ccfc25d92856|Gemini API Key"
  "auth.google.client_id|019b3be4-3321-7f30-989b-3076ba1aa712||Google Client ID"
  "auth.google.client_secret|019b3be4-3321-7f34-b17e-9daa65547748||Google Client Secret"
  "auth.microsoft.client_id|019b3be4-3321-7f18-847d-823bd6a5c5f6||Microsoft Client ID"
  "auth.microsoft.client_secret|019b3be4-3321-7f09-81ff-ed052c711127||Microsoft Client Secret"
)

# --- Encrypt and generate SQL -------------------------------------------------
sql_statements=()
updated_count=0
updated_names=()

for entry in "${KEYS[@]}"; do
  IFS='|' read -r yaml_path key_res_id prov_key_id display_name <<< "$entry"

  # Read raw key from config
  raw_key=$(read_yaml "$config_file" ".$yaml_path")

  if [[ -z "$raw_key" || "$raw_key" == "null" || "$raw_key" == "None" ]]; then
    echo "  Skipping $display_name - not configured"
    continue
  fi

  if $dry_run; then
    echo "  Would update: $display_name (${raw_key:0:8}...)"
    updated_count=$((updated_count + 1))
    updated_names+=("$display_name")
    continue
  fi

  # Encrypt using Node.js
  encrypted=$(SECRET_KEY="$SECRET_KEY" node "$encrypt_script" "$raw_key" 2>/dev/null) || {
    echo "  WARNING: Failed to encrypt $display_name - skipping"
    continue
  }

  if [[ -z "$encrypted" ]]; then
    echo "  WARNING: Empty encryption result for $display_name - skipping"
    continue
  fi

  # Escape single quotes in encrypted value for SQL
  escaped_encrypted="${encrypted//\'/\'\'}"

  # Generate SQL UPDATE for keys_resource
  sql_statements+=("UPDATE keys_resource SET key = '${escaped_encrypted}' WHERE id = '${key_res_id}';")

  # Generate SQL UPDATE for provider_keys_resource (if applicable)
  if [[ -n "$prov_key_id" ]]; then
    sql_statements+=("UPDATE provider_keys_resource SET key = '${escaped_encrypted}' WHERE id = '${prov_key_id}';")
  fi

  updated_count=$((updated_count + 1))
  updated_names+=("$display_name")
done

if [[ $updated_count -eq 0 ]]; then
  echo "No keys to bootstrap."
  exit 0
fi

if $dry_run; then
  echo ""
  echo "Dry run: Would update $updated_count keys ($(IFS=', '; echo "${updated_names[*]}"))"
  exit 0
fi

# --- Execute or append --------------------------------------------------------
if [[ -n "$append_file" ]]; then
  # Append mode: write SQL statements to file
  {
    echo ""
    echo "-- ================================================================"
    echo "-- Bootstrap API Keys (auto-generated by bootstrap-keys.sh)"
    echo "-- ================================================================"
    for stmt in "${sql_statements[@]}"; do
      echo "$stmt"
    done
  } >> "$append_file"
  echo "Appended $updated_count key updates to $append_file ($(IFS=', '; echo "${updated_names[*]}"))"
else
  # Direct mode: run against live database
  {
    for stmt in "${sql_statements[@]}"; do
      echo "$stmt"
    done
  } | psql "$DB_URL" --quiet -v ON_ERROR_STOP=1 2>&1 | grep -v "^$" || true
  echo "Updated $updated_count keys in database ($(IFS=', '; echo "${updated_names[*]}"))"
fi
