#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Load Modular Seed Data
# =============================================================================
# Reads a YAML config file and assembles seed SQL from module files.
# Can either output a combined SQL file or pipe directly to psql.
#
# Usage:
#   ./load-modules.sh                              # Use default config.yaml
#   ./load-modules.sh config.yaml                  # Use specific config
#   ./load-modules.sh config.yaml --output         # Write to timestamped file
#   ./load-modules.sh config.yaml --output out.sql # Write to specific file
#   ./load-modules.sh --output                     # Default config, timestamped file
# =============================================================================

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
modules_dir="$script_dir/../modules"

# --- Parse args ---------------------------------------------------------------
config_file=""
output_mode=false
output_file=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      output_mode=true
      # Check if next arg is a file path (not another flag)
      if [[ -n "${2:-}" && "${2:0:1}" != "-" ]]; then
        output_file="$2"
        shift
      fi
      ;;
    *) config_file="$1" ;;
  esac
  shift
done

if [[ -z "$config_file" ]]; then
  config_file="$project_root/config.yaml"
  if [[ ! -f "$config_file" ]]; then
    config_file="$project_root/config.example.yaml"
  fi
fi

if [[ ! -f "$config_file" ]]; then
  echo "ERROR: Config file not found: $config_file"
  echo "Usage: $0 [config.yaml] [--output [file.sql]]"
  exit 1
fi

echo "Using config: $config_file"

# --- Load .env ----------------------------------------------------------------
if [[ -f "$script_dir/../.env" ]]; then
  set -a
  source "$script_dir/../.env"
  set +a
fi

DB_USER=${DB_USER:-myuser}
DB_PASSWORD=${DB_PASSWORD:-mypassword}
DB_NAME=${DB_NAME:-mydb}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# --- Detect yq or use Python fallback ----------------------------------------
read_yaml() {
  local file=$1
  local path=$2
  # Try yq first, fall back to Python
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
if isinstance(val, list):
    for item in val:
        print(item)
elif isinstance(val, dict):
    for key in val:
        print(key)
elif val == 'all':
    print('all')
else:
    print(val)
" 2>/dev/null || true
  fi
}

# Read a YAML list or "all" keyword
read_yaml_list() {
  local file=$1
  local path=$2
  read_yaml "$file" "$path"
}

# Read YAML map keys (for models grouped by provider)
read_yaml_map_keys() {
  local file=$1
  local path=$2
  read_yaml "$file" "$path"
}

# Read YAML list under a map key
read_yaml_map_list() {
  local file=$1
  local path=$2
  local key=$3
  read_yaml "$file" "${path}.${key}"
}

# --- Assemble SQL -------------------------------------------------------------
sql_parts=()
total_files=0

add_file() {
  local filepath=$1
  if [[ -f "$filepath" ]]; then
    sql_parts+=("$filepath")
    total_files=$((total_files + 1))
  else
    echo "  WARNING: Module file not found: $filepath"
  fi
}

add_dir_sorted() {
  local dir=$1
  if [[ -d "$dir" ]]; then
    while IFS= read -r f; do
      add_file "$f"
    done < <(find "$dir" -name "*.sql" -maxdepth 1 | sort)
  fi
}

# Helper: load a root-level per-artifact module (06-rubrics, 07-evals, etc.)
load_root_module() {
  local yaml_key=$1     # e.g., "rubrics"
  local folder=$2       # e.g., "06-rubrics"

  local items
  items=$(read_yaml_list "$config_file" ".modules.${yaml_key}")
  if [[ -z "$items" || "$items" == "null" ]]; then
    return
  fi

  echo "Loading ${folder}/ ..."
  local mod_dir="$modules_dir/$folder"
  if [[ "$items" == "all" ]]; then
    add_dir_sorted "$mod_dir"
  else
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      add_file "$mod_dir/${name}.sql"
    done <<< "$items"
  fi
}

# Helper: load categories for a setup type (organization or university)
load_setup_categories() {
  local setup_name=$1  # "organization" or "university"
  local setup_dir="$modules_dir/11-setups/$setup_name"

  # Check if this section exists in the YAML at all
  local section_check
  section_check=$(read_yaml "$config_file" ".modules.${setup_name}")
  if [[ -z "$section_check" || "$section_check" == "null" ]]; then
    return
  fi

  if [[ ! -d "$setup_dir" ]]; then
    echo "  WARNING: Setup directory not found: $setup_dir"
    return
  fi

  echo "Loading 11-setups/$setup_name/ ..."

  # Institution auth (if present)
  if [[ -d "$setup_dir/00-auth" ]]; then
    echo "  Loading 00-auth/ ..."
    add_dir_sorted "$setup_dir/00-auth"
  fi

  # Load each category using the YAML key → directory mapping
  local category subfolder
  local categories=(
    "departments:01-departments"
    "personas:02-personas"
    "documents:03-documents"
    "uploads:uploads"
    "texts:texts"
    "fields:04-fields"
    "parameters:05-parameters"
    "rubrics:05-rubrics"
    "simulations:06-simulations"
    "scenarios:07-scenarios"
    "cohorts:08-cohorts"
    "profiles:09-profiles"
    "settings:10-settings"
  )

  for pair in "${categories[@]}"; do
    category="${pair%%:*}"
    subfolder="${pair##*:}"

    local cat_dir="$setup_dir/$subfolder"
    [[ ! -d "$cat_dir" ]] && continue

    local items
    items=$(read_yaml_list "$config_file" ".modules.${setup_name}.${category}")
    if [[ -z "$items" || "$items" == "null" ]]; then
      continue
    fi

    echo "  Loading $subfolder/ ..."
    if [[ "$items" == "all" ]]; then
      add_dir_sorted "$cat_dir"
    else
      while IFS= read -r name; do
        [[ -z "$name" ]] && continue
        # Try exact name first, then all.sql
        if [[ -f "$cat_dir/${name}.sql" ]]; then
          add_file "$cat_dir/${name}.sql"
        elif [[ -f "$cat_dir/all.sql" ]]; then
          # Category uses all.sql, just add it once
          if ! printf '%s\n' "${sql_parts[@]}" | grep -q "$cat_dir/all.sql"; then
            add_file "$cat_dir/all.sql"
          fi
        fi
      done <<< "$items"
    fi
  done
}

echo ""
echo "=== Assembling seed SQL from modules ==="
echo ""

# --- 00-relations: Always loaded -----------------------------------------------
echo "Loading 00-relations/ (always included) ..."
add_dir_sorted "$modules_dir/00-relations"

# --- 01-resources: Always loaded -----------------------------------------------
echo "Loading 01-resources/ (always included) ..."
add_dir_sorted "$modules_dir/01-resources"

# --- 02-providers -------------------------------------------------------------
providers=$(read_yaml_list "$config_file" ".modules.providers")
if [[ -n "$providers" ]]; then
  echo "Loading 02-providers/ ..."
  if [[ "$providers" == "all" ]]; then
    add_dir_sorted "$modules_dir/02-providers"
  else
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      add_file "$modules_dir/02-providers/${name}.sql"
    done <<< "$providers"
  fi
fi

# --- 03-models ----------------------------------------------------------------
model_providers=$(read_yaml_map_keys "$config_file" ".modules.models")
if [[ -n "$model_providers" ]]; then
  echo "Loading 03-models/ ..."
  if [[ "$model_providers" == "all" ]]; then
    # Load all models for all providers
    for provider_dir in "$modules_dir"/03-models/*/; do
      add_dir_sorted "$provider_dir"
    done
  else
    while IFS= read -r provider; do
      [[ -z "$provider" ]] && continue
      model_list=$(read_yaml_map_list "$config_file" ".modules.models" "$provider")
      if [[ "$model_list" == "all" ]]; then
        add_dir_sorted "$modules_dir/03-models/$provider"
      else
        while IFS= read -r model; do
          [[ -z "$model" ]] && continue
          add_file "$modules_dir/03-models/$provider/${model}.sql"
        done <<< "$model_list"
      fi
    done <<< "$model_providers"
  fi
fi

# --- 04-agents ----------------------------------------------------------------
agents=$(read_yaml_list "$config_file" ".modules.agents")
if [[ -n "$agents" ]]; then
  echo "Loading 04-agents/ ..."
  if [[ "$agents" == "all" ]]; then
    add_dir_sorted "$modules_dir/04-agents"
  else
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      add_file "$modules_dir/04-agents/${name}.sql"
    done <<< "$agents"
  fi
fi

# --- 05-tools ----------------------------------------------------------------
tools=$(read_yaml_list "$config_file" ".modules.tools")
if [[ -n "$tools" ]]; then
  echo "Loading 05-tools/ ..."
  if [[ "$tools" == "all" ]]; then
    add_dir_sorted "$modules_dir/05-tools"
  else
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      add_file "$modules_dir/05-tools/${name}.sql"
    done <<< "$tools"
  fi
fi

# --- 06-auth ------------------------------------------------------------------
auth_list=$(read_yaml_list "$config_file" ".modules.auth")
if [[ -n "$auth_list" ]]; then
  echo "Loading 06-auth/ ..."
  if [[ "$auth_list" == "all" ]]; then
    add_dir_sorted "$modules_dir/06-auth"
  else
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      add_file "$modules_dir/06-auth/${name}.sql"
    done <<< "$auth_list"
  fi
fi

# --- 07-rubrics ---------------------------------------------------------------
load_root_module "rubrics" "07-rubrics"

# --- 08-evals ----------------------------------------------------------------
load_root_module "evals" "08-evals"

# --- 09-profiles --------------------------------------------------------------
load_root_module "profiles" "09-profiles"

# --- 10-settings --------------------------------------------------------------
load_root_module "settings" "10-settings"

# --- 11-setups: Organization --------------------------------------------------
load_setup_categories "organization"

# --- 11-setups: University ----------------------------------------------------
# Only load university if the config declares it
load_setup_categories "university"

echo ""
echo "Assembled $total_files module files"

if [[ ${#sql_parts[@]} -eq 0 ]]; then
  echo "WARNING: No module files found. Check your config."
  exit 1
fi

# --- Output or execute --------------------------------------------------------
if $output_mode; then
  # Determine output file path
  if [[ -z "$output_file" ]]; then
    timestamp=$(date +%Y%m%d_%H%M%S)
    output_file="$script_dir/../seeds/seed_modules_${timestamp}.sql"
  fi
  mkdir -p "$(dirname "$output_file")"

  {
    echo "-- Generated seed file from modular modules"
    echo "-- Config: $config_file"
    echo "-- Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "-- Files: $total_files"
    echo ""
    echo "SET session_replication_role = replica;"
    echo ""
    for f in "${sql_parts[@]}"; do
      echo "-- ================================================================"
      echo "-- File: $(basename "$f")"
      echo "-- ================================================================"
      cat "$f"
      echo ""
    done
    echo ""
    echo "SET session_replication_role = DEFAULT;"
  } > "$output_file"

  echo ""
  echo "Written to: $output_file"
else
  # Pipe directly to psql
  echo "Loading into database: $DB_NAME ..."
  {
    echo "SET session_replication_role = replica;"
    for f in "${sql_parts[@]}"; do
      cat "$f"
      echo ""
    done
    echo "SET session_replication_role = DEFAULT;"
  } | psql "$DB_URL" -v ON_ERROR_STOP=0 --quiet 2>&1 | grep -v "^$" || true

  # Copy upload files to the project uploads directory (handles subdirectories)
  uploads_dir="$project_root/uploads"
  for setup_name in organization university; do
    uploads_files_dir="$modules_dir/11-setups/$setup_name/uploads/files"
    if [[ -d "$uploads_files_dir" ]]; then
      mkdir -p "$uploads_dir"
      echo "Copying upload files from $setup_name/uploads/files/ ..."
      # Use cp -Rn to handle subdirectories (e.g., image/ for page PNGs)
      cp -Rn "$uploads_files_dir"/ "$uploads_dir/" 2>/dev/null || true
    fi
  done

  echo ""
  echo "=== Seed loading complete ==="
fi
