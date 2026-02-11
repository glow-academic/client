#!/usr/bin/env bash
set -euo pipefail

# Portable lowercase function (works on macOS bash 3)
to_slug() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g; s/(/-/g; s/)/-/g; s/--*/-/g; s/-$//'
}

# =============================================================================
# Export Modular Seed Data
# =============================================================================
# Generates object-based SQL module files from the live database.
# Each file contains all INSERTs needed for a single logical object
# (artifact + junctions + resource rows), with ON CONFLICT DO NOTHING.
#
# Usage:
#   ./export-modules.sh           # Export all modules
#   ./export-modules.sh base      # Export only 00-base/
#   ./export-modules.sh providers # Export only 01-providers/
#   ./export-modules.sh models    # Export only 02-models/
#   ./export-modules.sh agents    # Export only 03-agents/
#   ./export-modules.sh tools     # Export only 04-tools/
#   ./export-modules.sh auth      # Export only 05-auth/
#   ./export-modules.sh setup     # Export only 10-setups/university/
# =============================================================================

# --- LOAD .env ---------------------------------------------------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${script_dir}/../.env" ]]; then
  set -a
  source "${script_dir}/../.env"
  set +a
fi

# --- CONFIG ------------------------------------------------------------------
DB_USER=${DB_USER:-myuser}
DB_PASSWORD=${DB_PASSWORD:-mypassword}
DB_NAME=${DB_NAME:-mydb}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

MODULES_DIR="${script_dir}/../modules"

# --- HELPERS -----------------------------------------------------------------

# Run a query and return results (no headers, no alignment)
run_query() {
  psql "$DB_URL" -t -A -c "$1" 2>/dev/null
}

# Get column list for a table (comma-separated)
get_columns() {
  local table=$1
  run_query "
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$table';
  "
}

# Get primary key columns for a table (comma-separated)
get_pk_columns() {
  local table=$1
  run_query "
    SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = '$table'
      AND tc.constraint_type = 'PRIMARY KEY';
  "
}

# Format a SQL value for INSERT (handles NULL, timestamps, text escaping)
format_value() {
  local val=$1
  local type=$2
  if [[ "$val" == "" ]]; then
    echo "NULL"
  elif [[ "$type" == *"timestamp"* ]]; then
    echo "'$val'"
  elif [[ "$type" == *"bool"* ]]; then
    if [[ "$val" == "t" ]]; then
      echo "true"
    elif [[ "$val" == "f" ]]; then
      echo "false"
    else
      echo "$val"
    fi
  elif [[ "$type" == *"int"* ]] || [[ "$type" == *"numeric"* ]] || [[ "$type" == *"double"* ]] || [[ "$type" == *"real"* ]]; then
    echo "$val"
  elif [[ "$type" == *"uuid"* ]]; then
    echo "'$val'"
  elif [[ "$type" == *"ARRAY"* ]]; then
    echo "'$val'"
  else
    # Escape single quotes in text
    local escaped="${val//\'/\'\'}"
    echo "'$escaped'"
  fi
}

# Export a full table dump with ON CONFLICT (id) DO NOTHING
# Used for base resource tables that are exported entirely
export_table_full() {
  local table=$1
  local output_file=$2
  local pk_cols
  pk_cols=$(get_pk_columns "$table")

  if [[ -z "$pk_cols" ]]; then
    # No PK — use plain INSERT (no ON CONFLICT)
    echo "" >> "$output_file"
    echo "-- Table: $table (no PK, plain INSERT)" >> "$output_file"

    local inserts
    inserts=$(pg_dump --data-only --inserts --rows-per-insert=1 \
      --exclude-schema=keycloak \
      --table="public.$table" \
      --format=plain "$DB_URL" 2>/dev/null | grep "^INSERT INTO" || true)

    if [[ -n "$inserts" ]]; then
      echo "$inserts" >> "$output_file"
    else
      echo "-- (no rows)" >> "$output_file"
    fi
    return
  fi

  echo "" >> "$output_file"
  echo "-- Table: $table" >> "$output_file"

  # Use pg_dump to get INSERT statements, then add ON CONFLICT
  local inserts
  inserts=$(pg_dump --data-only --inserts --rows-per-insert=1 \
    --exclude-schema=keycloak \
    --table="public.$table" \
    --format=plain "$DB_URL" 2>/dev/null | grep "^INSERT INTO" || true)

  if [[ -z "$inserts" ]]; then
    echo "-- (no rows)" >> "$output_file"
    return
  fi

  # Add ON CONFLICT DO NOTHING to each INSERT
  while IFS= read -r line; do
    # Remove trailing semicolon, add ON CONFLICT
    local base="${line%;}"
    echo "${base} ON CONFLICT ($pk_cols) DO NOTHING;" >> "$output_file"
  done <<< "$inserts"
}

# Export rows from a table WHERE a column matches a value, with ON CONFLICT
# Returns the generated INSERT statements (for inline use)
export_rows_where() {
  local table=$1
  local where_col=$2
  local where_val=$3
  local output_file=$4
  local pk_cols
  pk_cols=$(get_pk_columns "$table")

  local cols
  cols=$(get_columns "$table")

  local rows
  rows=$(run_query "
    SELECT $cols FROM public.$table
    WHERE $where_col = '$where_val'
    ORDER BY created_at;
  " 2>/dev/null || true)

  if [[ -z "$rows" ]]; then
    return
  fi

  # Get column types for proper formatting
  local col_types
  col_types=$(run_query "
    SELECT string_agg(data_type, '|' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$table';
  ")

  echo "-- $table" >> "$output_file"
  while IFS= read -r row; do
    if [[ -z "$row" ]]; then continue; fi

    # Split row by pipe delimiter
    IFS='|' read -ra values <<< "$row"
    IFS='|' read -ra types <<< "$col_types"

    local formatted_vals=""
    for i in "${!values[@]}"; do
      local fv
      fv=$(format_value "${values[$i]}" "${types[$i]:-text}")
      if [[ -n "$formatted_vals" ]]; then
        formatted_vals="$formatted_vals, $fv"
      else
        formatted_vals="$fv"
      fi
    done

    echo "INSERT INTO public.$table ($cols) VALUES ($formatted_vals) ON CONFLICT ($pk_cols) DO NOTHING;" >> "$output_file"
  done <<< "$rows"
}

# Export a single resource row by ID, following a junction FK
# junction_table -> resource_col -> resource_table
export_resource_via_junction() {
  local artifact_type=$1    # e.g., "model"
  local artifact_id=$2      # the artifact UUID
  local junction_table=$3   # e.g., "model_names_junction"
  local resource_col=$4     # FK column in junction pointing to resource, e.g., "name_id"
  local resource_table=$5   # e.g., "names_resource"
  local output_file=$6

  # Get resource IDs from junction
  local resource_ids
  resource_ids=$(run_query "
    SELECT $resource_col FROM public.$junction_table
    WHERE ${artifact_type}_id = '$artifact_id';
  ")

  if [[ -z "$resource_ids" ]]; then
    return
  fi

  local resource_pk
  resource_pk=$(get_pk_columns "$resource_table")
  local resource_cols
  resource_cols=$(get_columns "$resource_table")
  local col_types
  col_types=$(run_query "
    SELECT string_agg(data_type, '|' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$resource_table';
  ")

  while IFS= read -r rid; do
    if [[ -z "$rid" ]]; then continue; fi

    local row
    row=$(run_query "SELECT $resource_cols FROM public.$resource_table WHERE $resource_pk = '$rid';")

    if [[ -z "$row" ]]; then continue; fi

    IFS='|' read -ra values <<< "$row"
    IFS='|' read -ra types <<< "$col_types"

    local formatted_vals=""
    for i in "${!values[@]}"; do
      local fv
      fv=$(format_value "${values[$i]}" "${types[$i]:-text}")
      if [[ -n "$formatted_vals" ]]; then
        formatted_vals="$formatted_vals, $fv"
      else
        formatted_vals="$fv"
      fi
    done

    echo "INSERT INTO public.$resource_table ($resource_cols) VALUES ($formatted_vals) ON CONFLICT ($resource_pk) DO NOTHING;" >> "$output_file"
  done <<< "$resource_ids"
}

# Export junction rows for an artifact
export_junction_rows() {
  local artifact_type=$1
  local artifact_id=$2
  local junction_table=$3
  local output_file=$4

  local pk_cols
  pk_cols=$(get_pk_columns "$junction_table")
  local cols
  cols=$(get_columns "$junction_table")
  local col_types
  col_types=$(run_query "
    SELECT string_agg(data_type, '|' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$junction_table';
  ")

  local rows
  rows=$(run_query "SELECT $cols FROM public.$junction_table WHERE ${artifact_type}_id = '$artifact_id';")

  if [[ -z "$rows" ]]; then
    return
  fi

  echo "-- $junction_table" >> "$output_file"
  while IFS= read -r row; do
    if [[ -z "$row" ]]; then continue; fi

    IFS='|' read -ra values <<< "$row"
    IFS='|' read -ra types <<< "$col_types"

    local formatted_vals=""
    for i in "${!values[@]}"; do
      local fv
      fv=$(format_value "${values[$i]}" "${types[$i]:-text}")
      if [[ -n "$formatted_vals" ]]; then
        formatted_vals="$formatted_vals, $fv"
      else
        formatted_vals="$fv"
      fi
    done

    echo "INSERT INTO public.$junction_table ($cols) VALUES ($formatted_vals) ON CONFLICT ($pk_cols) DO NOTHING;" >> "$output_file"
  done <<< "$rows"
}

# Export an artifact row by ID
export_artifact_row() {
  local table=$1
  local artifact_id=$2
  local output_file=$3

  local pk_cols
  pk_cols=$(get_pk_columns "$table")
  local cols
  cols=$(get_columns "$table")
  local col_types
  col_types=$(run_query "
    SELECT string_agg(data_type, '|' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$table';
  ")

  local row
  row=$(run_query "SELECT $cols FROM public.$table WHERE id = '$artifact_id';")

  if [[ -z "$row" ]]; then
    echo "    WARNING: No row found in $table for id=$artifact_id"
    return
  fi

  echo "-- $table" >> "$output_file"

  IFS='|' read -ra values <<< "$row"
  IFS='|' read -ra types <<< "$col_types"

  local formatted_vals=""
  for i in "${!values[@]}"; do
    local fv
    fv=$(format_value "${values[$i]}" "${types[$i]:-text}")
    if [[ -n "$formatted_vals" ]]; then
      formatted_vals="$formatted_vals, $fv"
    else
      formatted_vals="$fv"
    fi
  done

  echo "INSERT INTO public.$table ($cols) VALUES ($formatted_vals) ON CONFLICT ($pk_cols) DO NOTHING;" >> "$output_file"
}

# Map junction table to its resource FK column and resource table
# Returns: resource_col|resource_table
get_junction_resource_mapping() {
  local junction_table=$1
  local artifact_type=$2

  # Get FK column that is NOT the artifact_id column
  local fk_col
  fk_col=$(run_query "
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$junction_table'
      AND column_name != '${artifact_type}_id'
      AND column_name LIKE '%_id'
    ORDER BY ordinal_position
    LIMIT 1;
  ")

  if [[ -z "$fk_col" ]]; then
    echo ""
    return
  fi

  # Derive resource table from FK column name
  # e.g., name_id -> names_resource, description_id -> descriptions_resource
  # e.g., providers_id -> providers_resource, pricing_id -> pricing_resource
  local resource_name="${fk_col%_id}"

  # Try exact match first (e.g., providers_resource)
  local resource_table="${resource_name}_resource"
  local exists
  exists=$(run_query "
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '$resource_table'
    LIMIT 1;
  ")

  if [[ -z "$exists" ]]; then
    # Try pluralized (e.g., name_id -> names_resource)
    resource_table="${resource_name}s_resource"
    exists=$(run_query "
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = '$resource_table'
      LIMIT 1;
    ")
  fi

  if [[ -z "$exists" ]]; then
    echo ""
    return
  fi

  echo "$fk_col|$resource_table"
}

# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

# --- 00-base: System resource tables -----------------------------------------

# Helper: export one base module file
_export_base_file() {
  local base_dir=$1
  local file_prefix=$2
  local label=$3
  shift 3
  local tables=("$@")

  local output_file="$base_dir/${file_prefix}.sql"

  cat > "$output_file" << EOF
-- Module: $label
-- Category: base
-- Description: ${label} system data
-- ============================================================
EOF

  for table in "${tables[@]}"; do
    if [[ "$table" == "_RELATIONS_" ]]; then
      for rel_table in $(run_query "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%_relation' ORDER BY tablename;"); do
        export_table_full "$rel_table" "$output_file"
      done
    else
      export_table_full "$table" "$output_file"
    fi
  done

  local count
  count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
  echo "    ${file_prefix}.sql ($count inserts)"
}

export_base() {
  echo "Exporting 00-base/ ..."
  local base_dir="$MODULES_DIR/00-base"
  mkdir -p "$base_dir"

  _export_base_file "$base_dir" "00-relations"      "relations"      "_RELATIONS_"
  _export_base_file "$base_dir" "01-colors"          "colors"         "colors_resource"
  _export_base_file "$base_dir" "02-icons"           "icons"          "icons_resource"
  _export_base_file "$base_dir" "03-flags"           "flags"          "flags_resource"
  _export_base_file "$base_dir" "04-roles-routes"    "roles-routes"   "roles_resource" "routes_resource" "role_routes_resource"
  _export_base_file "$base_dir" "05-modalities"      "modalities"     "modalities_resource"
  _export_base_file "$base_dir" "06-qualities"       "qualities"      "qualities_resource"
  _export_base_file "$base_dir" "07-thresholds"      "thresholds"     "thresholds_resource"
  _export_base_file "$base_dir" "08-points"          "points"         "points_resource"
  _export_base_file "$base_dir" "09-protocols"       "protocols"      "protocols_resource"
  _export_base_file "$base_dir" "10-domains"         "domains"        "domains_resource"
  _export_base_file "$base_dir" "11-slugs"           "slugs"          "slugs_resource"
  _export_base_file "$base_dir" "12-texts"           "texts"          "texts_resource"
  _export_base_file "$base_dir" "13-templates"       "templates"      "templates_resource"
  _export_base_file "$base_dir" "14-args"            "args"           "args_resource" "args_outputs_resource"
  _export_base_file "$base_dir" "15-request-limits"  "request-limits" "request_limits_resource"
  _export_base_file "$base_dir" "16-voices"          "voices"         "voices_resource"
  _export_base_file "$base_dir" "17-values"          "values"         "values_resource"
}

# --- 01-providers: One file per AI provider -----------------------------------
export_providers() {
  echo "Exporting 01-providers/ ..."
  local providers_dir="$MODULES_DIR/01-providers"
  mkdir -p "$providers_dir"

  # Get all providers
  local providers
  providers=$(run_query "
    SELECT pa.id, nr.name
    FROM provider_artifact pa
    JOIN provider_names_junction pnj ON pa.id = pnj.provider_id
    JOIN names_resource nr ON pnj.name_id = nr.id
    ORDER BY nr.name;
  ")

  while IFS='|' read -r provider_id provider_name; do
    if [[ -z "$provider_id" ]]; then continue; fi

    local slug
    slug=$(to_slug "$provider_name")
    local output_file="$providers_dir/${slug}.sql"

    cat > "$output_file" << EOF
-- Module: $provider_name
-- Category: provider
-- Description: $provider_name AI provider
-- ============================================================

-- Resource rows
EOF

    # Get all junction tables for this provider and export resources + junctions
    local junction_tables
    junction_tables=$(run_query "
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'provider_%_junction'
      ORDER BY tablename;
    ")

    # First pass: export resource rows
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "provider")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "provider" "$provider_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    # Artifact row
    echo "" >> "$output_file"
    echo "-- Artifact" >> "$output_file"
    export_artifact_row "provider_artifact" "$provider_id" "$output_file"

    # Second pass: export junction rows
    echo "" >> "$output_file"
    echo "-- Junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "provider" "$provider_id" "$jt" "$output_file"
    done <<< "$junction_tables"

    local count
    count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
    echo "    $output_file ($count inserts)"
  done <<< "$providers"
}

# --- 02-models: One file per model, grouped by provider -----------------------
export_models() {
  echo "Exporting 02-models/ ..."

  # Get all models with their provider name
  local models
  models=$(run_query "
    SELECT ma.id, nr.name, pr.name as provider
    FROM model_artifact ma
    JOIN model_names_junction mnj ON ma.id = mnj.model_id
    JOIN names_resource nr ON mnj.name_id = nr.id
    JOIN model_providers_junction mpj ON ma.id = mpj.model_id
    JOIN providers_resource pr ON mpj.providers_id = pr.id
    ORDER BY pr.name, nr.name;
  ")

  # Track which model names we've already processed (for multi-row models like gpt-image-1)
  local processed_list=""

  while IFS='|' read -r model_id model_name provider_name; do
    if [[ -z "$model_id" ]]; then continue; fi

    local provider_slug
    provider_slug=$(to_slug "$provider_name")
    local model_slug
    model_slug=$(to_slug "$model_name")

    local models_dir="$MODULES_DIR/02-models/$provider_slug"
    mkdir -p "$models_dir"
    local output_file="$models_dir/${model_slug}.sql"

    # For models with multiple artifacts (e.g., gpt-image-1 quality variants),
    # append to existing file
    if ! echo "$processed_list" | grep -q "|${provider_slug}/${model_slug}|"; then
      # First time seeing this model name — create file with header
      cat > "$output_file" << EOF
-- Module: $model_name
-- Provider: $provider_name
-- Description: $provider_name $model_name model
-- ============================================================

-- Resource rows
EOF
      processed_list="${processed_list}|${provider_slug}/${model_slug}|"
    else
      echo "" >> "$output_file"
      echo "-- Additional artifact: $model_id" >> "$output_file"
    fi

    # Get junction tables
    local junction_tables
    junction_tables=$(run_query "
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'model_%_junction'
      ORDER BY tablename;
    ")

    # Export resource rows (via junctions)
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "model")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "model" "$model_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    # Artifact row
    echo "" >> "$output_file"
    export_artifact_row "model_artifact" "$model_id" "$output_file"

    # Junction rows
    echo "" >> "$output_file"
    echo "-- Junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "model" "$model_id" "$jt" "$output_file"
    done <<< "$junction_tables"

  done <<< "$models"

  # Count generated files
  local file_count
  file_count=$(find "$MODULES_DIR/02-models" -name "*.sql" | wc -l | tr -d ' ')
  echo "    Generated $file_count model module files"
}

# --- 03-agents: One file per system agent ------------------------------------
export_agents() {
  echo "Exporting 03-agents/ ..."
  local agents_dir="$MODULES_DIR/03-agents"
  mkdir -p "$agents_dir"

  # Get all agents
  local agents
  agents=$(run_query "
    SELECT aa.id, nr.name
    FROM agent_artifact aa
    JOIN agent_names_junction anj ON aa.id = anj.agent_id
    JOIN names_resource nr ON anj.name_id = nr.id
    ORDER BY nr.name;
  ")

  while IFS='|' read -r agent_id agent_name; do
    if [[ -z "$agent_id" ]]; then continue; fi

    local slug
    slug=$(to_slug "$agent_name")
    local output_file="$agents_dir/${slug}.sql"

    cat > "$output_file" << EOF
-- Module: $agent_name
-- Category: agent
-- Description: $agent_name system agent
-- ============================================================

-- Resource rows
EOF

    # Get junction tables
    local junction_tables
    junction_tables=$(run_query "
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'agent_%_junction'
      ORDER BY tablename;
    ")

    # Export resource rows
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "agent")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "agent" "$agent_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    # Artifact
    echo "" >> "$output_file"
    echo "-- Artifact" >> "$output_file"
    export_artifact_row "agent_artifact" "$agent_id" "$output_file"

    # Junctions
    echo "" >> "$output_file"
    echo "-- Junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "agent" "$agent_id" "$jt" "$output_file"
    done <<< "$junction_tables"

    local count
    count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
    echo "    $output_file ($count inserts)"
  done <<< "$agents"
}

# --- 04-tools: All tools in one file ----------------------------------------
export_tools() {
  echo "Exporting 04-tools/ ..."
  local tools_dir="$MODULES_DIR/04-tools"
  mkdir -p "$tools_dir"
  local output_file="$tools_dir/all.sql"

  cat > "$output_file" << EOF
-- Module: all tools
-- Category: tools
-- Description: All MCP tool definitions
-- ============================================================

EOF

  # Get all tools
  local tools
  tools=$(run_query "
    SELECT ta.id, nr.name
    FROM tool_artifact ta
    JOIN tool_names_junction tnj ON ta.id = tnj.tool_id
    JOIN names_resource nr ON tnj.name_id = nr.id
    ORDER BY nr.name;
  ")

  local junction_tables
  junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'tool_%_junction'
    ORDER BY tablename;
  ")

  while IFS='|' read -r tool_id tool_name; do
    if [[ -z "$tool_id" ]]; then continue; fi

    echo "" >> "$output_file"
    echo "-- Tool: $tool_name ($tool_id)" >> "$output_file"

    # Export resource rows
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "tool")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "tool" "$tool_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    # Artifact
    export_artifact_row "tool_artifact" "$tool_id" "$output_file"

    # Junctions
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "tool" "$tool_id" "$jt" "$output_file"
    done <<< "$junction_tables"

  done <<< "$tools"

  local count
  count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
  echo "    $output_file ($count inserts)"
}

# --- 05-auth: Generic auth providers ----------------------------------------
export_auth() {
  echo "Exporting 05-auth/ ..."
  local auth_dir="$MODULES_DIR/05-auth"
  mkdir -p "$auth_dir"

  # Get auth artifacts (only generic ones: Google, Microsoft)
  # Institution-specific ones go in 10-setups/
  local auths
  auths=$(run_query "
    SELECT aa.id, nr.name
    FROM auth_artifact aa
    JOIN auth_names_junction anj ON aa.id = anj.auth_id
    JOIN names_resource nr ON anj.name_id = nr.id
    ORDER BY nr.name;
  ")

  local junction_tables
  junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'auth_%_junction'
    ORDER BY tablename;
  ")

  while IFS='|' read -r auth_id auth_name; do
    if [[ -z "$auth_id" ]]; then continue; fi

    local slug
    slug=$(to_slug "$auth_name")

    # Determine if this is generic or institution-specific
    local output_dir="$auth_dir"
    if [[ "$auth_name" == *"Purdue"* ]] || [[ "$auth_name" == *"University"* ]]; then
      output_dir="$MODULES_DIR/10-setups/university/00-auth"
      mkdir -p "$output_dir"
    fi

    local output_file="$output_dir/${slug}.sql"

    cat > "$output_file" << EOF
-- Module: $auth_name
-- Category: auth
-- Description: $auth_name authentication provider
-- ============================================================

-- Resource rows
EOF

    # Export resource rows
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "auth")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "auth" "$auth_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    # Artifact
    echo "" >> "$output_file"
    echo "-- Artifact" >> "$output_file"
    export_artifact_row "auth_artifact" "$auth_id" "$output_file"

    # Junctions
    echo "" >> "$output_file"
    echo "-- Junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "auth" "$auth_id" "$jt" "$output_file"
    done <<< "$junction_tables"

    local count
    count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
    echo "    $output_file ($count inserts)"
  done <<< "$auths"
}

# --- 10-setups/university: Setup-specific objects ----------------------------

export_setup_departments() {
  echo "  Exporting 01-departments/ ..."
  local dept_dir="$MODULES_DIR/10-setups/university/01-departments"
  mkdir -p "$dept_dir"

  local depts
  depts=$(run_query "
    SELECT da.id, nr.name
    FROM department_artifact da
    JOIN department_names_junction dnj ON da.id = dnj.department_id
    JOIN names_resource nr ON dnj.name_id = nr.id
    ORDER BY nr.name;
  ")

  local junction_tables
  junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'department_%_junction'
    ORDER BY tablename;
  ")

  while IFS='|' read -r dept_id dept_name; do
    if [[ -z "$dept_id" ]]; then continue; fi

    local slug
    slug=$(to_slug "$dept_name" | sed 's/,//g')
    local output_file="$dept_dir/${slug}.sql"

    cat > "$output_file" << EOF
-- Module: $dept_name
-- Category: department
-- Description: $dept_name department
-- ============================================================

-- Resource rows
EOF

    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "department")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "department" "$dept_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    echo "" >> "$output_file"
    echo "-- Artifact" >> "$output_file"
    export_artifact_row "department_artifact" "$dept_id" "$output_file"

    echo "" >> "$output_file"
    echo "-- Junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "department" "$dept_id" "$jt" "$output_file"
    done <<< "$junction_tables"

    local count
    count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
    echo "    $output_file ($count inserts)"
  done <<< "$depts"
}

export_setup_personas() {
  echo "  Exporting 02-personas/ ..."
  local persona_dir="$MODULES_DIR/10-setups/university/02-personas"
  mkdir -p "$persona_dir"

  local personas
  personas=$(run_query "
    SELECT pa.id, nr.name
    FROM persona_artifact pa
    JOIN persona_names_junction pnj ON pa.id = pnj.persona_id
    JOIN names_resource nr ON pnj.name_id = nr.id
    ORDER BY nr.name;
  ")

  local junction_tables
  junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'persona_%_junction'
    ORDER BY tablename;
  ")

  while IFS='|' read -r persona_id persona_name; do
    if [[ -z "$persona_id" ]]; then continue; fi

    local slug
    slug=$(to_slug "$persona_name")
    local output_file="$persona_dir/${slug}.sql"

    cat > "$output_file" << EOF
-- Module: $persona_name
-- Category: persona
-- Description: $persona_name persona
-- ============================================================

-- Resource rows
EOF

    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "persona")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "persona" "$persona_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    echo "" >> "$output_file"
    echo "-- Artifact" >> "$output_file"
    export_artifact_row "persona_artifact" "$persona_id" "$output_file"

    echo "" >> "$output_file"
    echo "-- Junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "persona" "$persona_id" "$jt" "$output_file"
    done <<< "$junction_tables"

    local count
    count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
    echo "    $output_file ($count inserts)"
  done <<< "$personas"
}

export_setup_simulations() {
  echo "  Exporting 06-simulations/ ..."
  local sim_dir="$MODULES_DIR/10-setups/university/06-simulations"
  mkdir -p "$sim_dir"

  local sims
  sims=$(run_query "
    SELECT sa.id, nr.name
    FROM simulation_artifact sa
    JOIN simulation_names_junction snj ON sa.id = snj.simulation_id
    JOIN names_resource nr ON snj.name_id = nr.id
    ORDER BY nr.name;
  ")

  local sim_junction_tables
  sim_junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'simulation_%_junction'
    ORDER BY tablename;
  ")

  local scn_junction_tables
  scn_junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'scenario_%_junction'
    ORDER BY tablename;
  ")

  while IFS='|' read -r sim_id sim_name; do
    if [[ -z "$sim_id" ]]; then continue; fi

    local slug
    slug=$(to_slug "$sim_name")
    local output_file="$sim_dir/${slug}.sql"

    cat > "$output_file" << EOF
-- Module: $sim_name
-- Category: simulation
-- Description: $sim_name simulation with inline scenarios
-- ============================================================

-- Simulation resource rows
EOF

    # Export simulation resource rows
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "simulation")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "simulation" "$sim_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$sim_junction_tables"

    # Get scenarios linked to this simulation
    local scenario_ids
    scenario_ids=$(run_query "
      SELECT scenario_id FROM simulation_scenarios_junction
      WHERE simulation_id = '$sim_id';
    ")

    # Export each scenario's resources inline
    if [[ -n "$scenario_ids" ]]; then
      echo "" >> "$output_file"
      echo "-- Scenario resource rows" >> "$output_file"

      while IFS= read -r scn_id; do
        if [[ -z "$scn_id" ]]; then continue; fi

        # Export scenario resource rows
        while IFS= read -r jt; do
          if [[ -z "$jt" ]]; then continue; fi
          local mapping
          mapping=$(get_junction_resource_mapping "$jt" "scenario")
          if [[ -n "$mapping" ]]; then
            IFS='|' read -r fk_col resource_table <<< "$mapping"
            export_resource_via_junction "scenario" "$scn_id" "$jt" "$fk_col" "$resource_table" "$output_file"
          fi
        done <<< "$scn_junction_tables"
      done <<< "$scenario_ids"

      # Export scenario artifacts
      echo "" >> "$output_file"
      echo "-- Scenario artifacts" >> "$output_file"
      while IFS= read -r scn_id; do
        if [[ -z "$scn_id" ]]; then continue; fi
        export_artifact_row "scenario_artifact" "$scn_id" "$output_file"
      done <<< "$scenario_ids"

      # Export scenario junctions
      echo "" >> "$output_file"
      echo "-- Scenario junctions" >> "$output_file"
      while IFS= read -r scn_id; do
        if [[ -z "$scn_id" ]]; then continue; fi
        while IFS= read -r jt; do
          if [[ -z "$jt" ]]; then continue; fi
          export_junction_rows "scenario" "$scn_id" "$jt" "$output_file"
        done <<< "$scn_junction_tables"
      done <<< "$scenario_ids"
    fi

    # Simulation artifact
    echo "" >> "$output_file"
    echo "-- Simulation artifact" >> "$output_file"
    export_artifact_row "simulation_artifact" "$sim_id" "$output_file"

    # Simulation junctions
    echo "" >> "$output_file"
    echo "-- Simulation junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "simulation" "$sim_id" "$jt" "$output_file"
    done <<< "$sim_junction_tables"

    local count
    count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
    echo "    $output_file ($count inserts)"
  done <<< "$sims"
}

# Generic "all" exporter for artifact types in 10-setups/university
export_setup_all() {
  local artifact_type=$1      # e.g., "document"
  local artifact_table=$2     # e.g., "document_artifact"
  local subfolder=$3          # e.g., "03-documents"
  local output_name=$4        # e.g., "all"

  echo "  Exporting $subfolder/ ..."
  local out_dir="$MODULES_DIR/10-setups/university/$subfolder"
  mkdir -p "$out_dir"
  local output_file="$out_dir/${output_name}.sql"

  cat > "$output_file" << EOF
-- Module: all ${artifact_type}s
-- Category: setup/university
-- Description: All ${artifact_type} artifacts for university setup
-- ============================================================

EOF

  # Get all artifact IDs
  local artifact_ids
  artifact_ids=$(run_query "SELECT id FROM public.$artifact_table ORDER BY created_at;")

  if [[ -z "$artifact_ids" ]]; then
    echo "-- (no rows)" >> "$output_file"
    echo "    $output_file (0 inserts)"
    return
  fi

  local junction_tables
  junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE '${artifact_type}_%_junction'
    ORDER BY tablename;
  ")

  # First pass: all resource rows
  echo "-- Resource rows" >> "$output_file"
  while IFS= read -r art_id; do
    if [[ -z "$art_id" ]]; then continue; fi
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "$artifact_type")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "$artifact_type" "$art_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"
  done <<< "$artifact_ids"

  # Second pass: all artifacts
  echo "" >> "$output_file"
  echo "-- Artifacts" >> "$output_file"
  while IFS= read -r art_id; do
    if [[ -z "$art_id" ]]; then continue; fi
    export_artifact_row "$artifact_table" "$art_id" "$output_file"
  done <<< "$artifact_ids"

  # Third pass: all junctions
  echo "" >> "$output_file"
  echo "-- Junctions" >> "$output_file"
  while IFS= read -r art_id; do
    if [[ -z "$art_id" ]]; then continue; fi
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "$artifact_type" "$art_id" "$jt" "$output_file"
    done <<< "$junction_tables"
  done <<< "$artifact_ids"

  local count
  count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
  echo "    $output_file ($count inserts)"
}

export_setup_rubrics() {
  echo "  Exporting 05-rubrics/ ..."
  local rubric_dir="$MODULES_DIR/10-setups/university/05-rubrics"
  mkdir -p "$rubric_dir"

  local rubrics
  rubrics=$(run_query "
    SELECT ra.id, nr.name
    FROM rubric_artifact ra
    JOIN rubric_names_junction rnj ON ra.id = rnj.rubric_id
    JOIN names_resource nr ON rnj.name_id = nr.id
    ORDER BY nr.name;
  ")

  local junction_tables
  junction_tables=$(run_query "
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'rubric_%_junction'
    ORDER BY tablename;
  ")

  while IFS='|' read -r rubric_id rubric_name; do
    if [[ -z "$rubric_id" ]]; then continue; fi

    local slug
    slug=$(to_slug "$rubric_name")
    local output_file="$rubric_dir/${slug}.sql"

    cat > "$output_file" << EOF
-- Module: $rubric_name
-- Category: rubric
-- Description: $rubric_name
-- ============================================================

-- Resource rows
EOF

    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      local mapping
      mapping=$(get_junction_resource_mapping "$jt" "rubric")
      if [[ -n "$mapping" ]]; then
        IFS='|' read -r fk_col resource_table <<< "$mapping"
        export_resource_via_junction "rubric" "$rubric_id" "$jt" "$fk_col" "$resource_table" "$output_file"
      fi
    done <<< "$junction_tables"

    echo "" >> "$output_file"
    echo "-- Artifact" >> "$output_file"
    export_artifact_row "rubric_artifact" "$rubric_id" "$output_file"

    echo "" >> "$output_file"
    echo "-- Junctions" >> "$output_file"
    while IFS= read -r jt; do
      if [[ -z "$jt" ]]; then continue; fi
      export_junction_rows "rubric" "$rubric_id" "$jt" "$output_file"
    done <<< "$junction_tables"

    local count
    count=$(grep -c "INSERT INTO" "$output_file" 2>/dev/null || echo 0)
    echo "    $output_file ($count inserts)"
  done <<< "$rubrics"
}

export_setup() {
  echo "Exporting 10-setups/university/ ..."
  export_auth  # Handles splitting generic vs institution auth
  export_setup_departments
  export_setup_personas
  export_setup_all "document" "document_artifact" "03-documents" "all"
  export_setup_all "field" "field_artifact" "04-fields" "all"
  export_setup_rubrics
  export_setup_simulations
  export_setup_all "eval" "eval_artifact" "07-evals" "all"
  export_setup_all "cohort" "cohort_artifact" "08-cohorts" "all"
  export_setup_all "profile" "profile_artifact" "09-profiles" "all"
  export_setup_all "setting" "setting_artifact" "10-settings" "all"
}

# =============================================================================
# MAIN DISPATCH
# =============================================================================

case "${1:-all}" in
  base)
    export_base
    ;;
  providers)
    export_providers
    ;;
  models)
    export_models
    ;;
  agents)
    export_agents
    ;;
  tools)
    export_tools
    ;;
  auth)
    export_auth
    ;;
  setup)
    export_setup
    ;;
  all)
    echo "=== Exporting all modular seed data ==="
    echo ""
    export_base
    echo ""
    export_providers
    echo ""
    export_models
    echo ""
    export_agents
    echo ""
    export_tools
    echo ""
    export_setup
    echo ""
    echo "=== Export complete ==="
    echo "Module files are in: $MODULES_DIR/"
    ;;
  *)
    echo "Usage: $0 {all|base|providers|models|agents|tools|auth|setup}"
    echo ""
    echo "  all       - Export all modules (default)"
    echo "  base      - Export 00-base/ (system resources)"
    echo "  providers - Export 01-providers/"
    echo "  models    - Export 02-models/"
    echo "  agents    - Export 03-agents/"
    echo "  tools     - Export 04-tools/"
    echo "  auth      - Export 05-auth/"
    echo "  setup     - Export 10-setups/university/"
    exit 1
    ;;
esac
