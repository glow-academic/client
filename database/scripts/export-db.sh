#!/usr/bin/env bash
set -euo pipefail

# --- LOAD .env -------------------------------------------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${script_dir}/../.env" ]]; then
  set -a
  source "${script_dir}/../.env"
  set +a
fi

# --- CONFIG ----------------------------------------------------------
DB_USER=${DB_USER:-myuser}
DB_PASSWORD=${DB_PASSWORD:-mypassword}
DB_NAME=${DB_NAME:-mydb}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Find pg_dump (prefer PostgreSQL 18)
if [[ -d "/opt/homebrew/opt/postgresql@18/bin" ]]; then
  export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
elif [[ -d "/usr/local/opt/postgresql@18/bin" ]]; then
  export PATH="/usr/local/opt/postgresql@18/bin:$PATH"
fi

PG_DUMP=$(command -v pg_dump || echo "pg_dump")

# Change to database directory (where output files should be created)
cd "${script_dir}/.."

# --- HELPER FUNCTIONS -----------------------------------------------

# Function to export entire table
export_table_all() {
    local table=$1
    local output_file=$2
    $PG_DUMP --data-only --inserts --exclude-schema=keycloak --table="public.$table" --format=plain "$DB_URL" 2>/dev/null | \
        grep "^INSERT INTO" >> "$output_file" || true
}

# Function to get tables matching a pattern from pg_tables
get_tables() {
    local pattern=$1
    psql "$DB_URL" -t -A -c "
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE '$pattern'
        ORDER BY tablename;
    " 2>/dev/null
}

# Function to export all tables matching a pattern
export_tables_matching() {
    local pattern=$1
    local output_file=$2
    local label=$3
    local count=0

    while IFS= read -r table; do
        if [ -n "$table" ]; then
            export_table_all "$table" "$output_file"
            count=$((count + 1))
        fi
    done < <(get_tables "$pattern")

    echo "    Exported $count tables matching '$pattern'"
}

# --- EXPORT FUNCTIONS -----------------------------------------------

# Schema export (inline, trivial)
export_schema() {
    local OUTPUT_FILE="schema.sql"

    echo "Generating schema.sql file..."

    # Generate schema-only dump (DDL for tables + indexes + constraints, etc.) with zero data
    # Excludes keycloak schema and provides cleaner format
    $PG_DUMP \
        --schema-only \
        --no-owner \
        --no-privileges \
        --exclude-schema=keycloak \
        --format=plain \
        --file="$OUTPUT_FILE" \
        "$DB_URL"

    echo ""
    echo "Done! Generated $OUTPUT_FILE"
    echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
    echo "Line count: $(wc -l < "$OUTPUT_FILE")"
}

# Base seed export function
# Exports: all resource tables + model/agent artifacts + their junctions + relation tables
export_base() {
    local OUTPUT_FILE="base.sql"

    echo "Generating base.sql seed file..."

    # Start with header
    cat > "$OUTPUT_FILE" << 'EOF'
-- Base Seed Data (Resource/Artifact/Junction pattern)
-- This file contains the foundational seed data:
-- - All shared resource tables (names, descriptions, colors, icons, flags, etc.)
-- - All entity-specific resource tables (models, agents, personas, scenarios, etc.)
-- - Model artifacts and their junctions
-- - Agent artifacts and their junctions
-- - Relation tables (artifact/resource metadata)

-- Load schema first: psql "$DB_URL" < schema.sql
-- Then load this: psql "$DB_URL" < base.sql

-- Disable FK checks during loading (resource tables may reference artifacts loaded later)
SET session_replication_role = replica;

EOF

    echo "Step 1: Exporting all resource tables..."

    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- RESOURCE TABLES" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"

    export_tables_matching "%_resource" "$OUTPUT_FILE" "resource"

    echo "Step 2: Exporting model artifacts and junctions..."

    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- MODEL ARTIFACTS + JUNCTIONS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"

    export_table_all "model_artifact" "$OUTPUT_FILE"
    export_tables_matching "model_%_junction" "$OUTPUT_FILE" "model junction"

    echo "Step 3: Exporting agent artifacts and junctions..."

    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- AGENT ARTIFACTS + JUNCTIONS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"

    export_table_all "agent_artifact" "$OUTPUT_FILE"
    export_tables_matching "agent_%_junction" "$OUTPUT_FILE" "agent junction"

    echo "Step 4: Exporting relation tables..."

    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- RELATION TABLES" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"

    export_tables_matching "%_relation" "$OUTPUT_FILE" "relation"

    # Restore normal FK checking
    echo "" >> "$OUTPUT_FILE"
    echo "-- Restore FK checking" >> "$OUTPUT_FILE"
    echo "SET session_replication_role = DEFAULT;" >> "$OUTPUT_FILE"

    echo ""
    echo "Done! Generated $OUTPUT_FILE"
    echo "Total INSERT statements: $(grep -c 'INSERT INTO' "$OUTPUT_FILE" 2>/dev/null || echo 0)"
}

# Institution seed export function (shared for university/organization)
# Exports: all remaining artifacts + their junctions + profiles + settings + config connections
export_institution() {
    local type=$1  # "university" or "organization"
    local OUTPUT_FILE="${type}.sql"

    echo "Generating ${OUTPUT_FILE} seed file..."

    # Start with header
    if [ "$type" = "university" ]; then
        cat > "$OUTPUT_FILE" << 'EOF'
-- University Seed Data (Resource/Artifact/Junction pattern)
-- This file contains the institution-specific seed data:
-- - All remaining artifacts (personas, scenarios, simulations, etc.)
-- - All remaining junction tables (persona_*, scenario_*, profile_*, etc.)
-- - Config connection tables
-- - Benchmark/training entry and connection tables

-- Load schema first: psql "$DB_URL" < schema.sql
-- Then load base: psql "$DB_URL" < base.sql
-- Then load this: psql "$DB_URL" < university.sql

-- Disable FK checks during loading
SET session_replication_role = replica;

EOF
    else
        cat > "$OUTPUT_FILE" << 'EOF'
-- Organization Seed Data
-- This file contains organization-specific seed data.
-- Currently a no-op - no data is exported.

-- Load schema first: psql "$DB_URL" < schema.sql
-- Then load base: psql "$DB_URL" < base.sql
-- Then load this: psql "$DB_URL" < organization.sql

EOF
    fi

    # Organization is currently a no-op
    if [ "$type" = "organization" ]; then
        echo ""
        echo "Done! Generated $OUTPUT_FILE (no-op for now)"
        echo "Total INSERT statements: 0"
        return
    fi

    # University export logic
    echo "Step 1: Exporting remaining artifacts..."

    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- REMAINING ARTIFACTS" >> "$OUTPUT_FILE"
    echo "-- (all except model_artifact, agent_artifact)" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"

    # Export all artifact tables except model and agent (already in base.sql)
    while IFS= read -r table; do
        if [ -n "$table" ] && [ "$table" != "model_artifact" ] && [ "$table" != "agent_artifact" ]; then
            export_table_all "$table" "$OUTPUT_FILE"
        fi
    done < <(get_tables "%_artifact")
    echo "    Exported remaining artifact tables"

    echo "Step 2: Exporting remaining junction tables..."

    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- REMAINING JUNCTION TABLES" >> "$OUTPUT_FILE"
    echo "-- (all except model_* and agent_* junctions)" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"

    # Export all junction tables except model_* and agent_* (already in base.sql)
    while IFS= read -r table; do
        if [ -n "$table" ]; then
            case "$table" in
                model_*_junction|agent_*_junction) continue ;;
                *) export_table_all "$table" "$OUTPUT_FILE" ;;
            esac
        fi
    done < <(get_tables "%_junction")
    echo "    Exported remaining junction tables"

    echo "Step 3: Exporting config and entry connection tables..."

    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- CONFIG + ENTRY CONNECTIONS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"

    # Export config connections (system configuration)
    export_tables_matching "config_%_connection" "$OUTPUT_FILE" "config connection"

    # Export benchmark entry/bundle tables
    export_tables_matching "benchmark_%" "$OUTPUT_FILE" "benchmark"

    # Export training entry/bundle tables
    export_tables_matching "training_%" "$OUTPUT_FILE" "training"

    # NOTE: Skipping *_calls_connection and *_drafts_connection tables
    # These are runtime data (call history, draft state), not seed data

    # Restore normal FK checking
    echo "" >> "$OUTPUT_FILE"
    echo "-- Restore FK checking" >> "$OUTPUT_FILE"
    echo "SET session_replication_role = DEFAULT;" >> "$OUTPUT_FILE"

    echo ""
    echo "Done! Generated $OUTPUT_FILE"
    echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
    echo "Line count: $(wc -l < "$OUTPUT_FILE")"
}

# --- MAIN DISPATCH LOGIC --------------------------------------------

case "${1:-}" in
    schema)
        export_schema
        ;;
    base)
        export_base
        ;;
    university)
        export_institution "university"
        ;;
    organization)
        export_institution "organization"
        ;;
    *)
        echo "Usage: $0 {schema|base|university|organization}"
        echo ""
        echo "  schema       - Export database schema (DDL only)"
        echo "  base         - Export base seed data (resources, models, agents)"
        echo "  university   - Export university seed data (personas, scenarios, profiles, etc.)"
        echo "  organization - Export organization seed data (currently no-op)"
        exit 1
        ;;
esac
