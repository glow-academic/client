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

# Function to export table with WHERE clause using temporary view
export_table_where() {
    local table=$1
    local where=$2
    local output_file=$3
    local temp_view="temp_export_${table}_$$"
    
    # Create temporary view
    if ! psql "$DB_URL" -c "CREATE OR REPLACE VIEW $temp_view AS SELECT * FROM public.$table WHERE $where;" > /dev/null 2>&1; then
        echo "    Warning: Failed to create view for $table"
        return 1
    fi
    
    # Export using pg_dump (with timeout for slow operations)
    if command -v gtimeout > /dev/null 2>&1; then
        gtimeout 30 $PG_DUMP --data-only --inserts --exclude-schema=keycloak --table="public.$temp_view" --format=plain "$DB_URL" 2>/dev/null | \
            grep "^INSERT INTO" | \
            sed "s/INSERT INTO public.$temp_view/INSERT INTO public.$table/" >> "$output_file" || true
    else
        $PG_DUMP --data-only --inserts --exclude-schema=keycloak --table="public.$temp_view" --format=plain "$DB_URL" 2>/dev/null | \
            grep "^INSERT INTO" | \
            sed "s/INSERT INTO public.$temp_view/INSERT INTO public.$table/" >> "$output_file" || true
    fi
    
    # Drop temporary view
    psql "$DB_URL" -c "DROP VIEW IF EXISTS $temp_view;" > /dev/null 2>&1
}

# Function to export entire table
export_table_all() {
    local table=$1
    local output_file=$2
    $PG_DUMP --data-only --inserts --exclude-schema=keycloak --table="public.$table" --format=plain "$DB_URL" 2>/dev/null | \
        grep "^INSERT INTO" >> "$output_file" || true
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
export_base() {
    local OUTPUT_FILE="base.sql"
    
    echo "Generating base.sql seed file..."
    
    # Start with header
    cat > "$OUTPUT_FILE" << 'EOF'
-- Base Seed Data
-- This file contains the foundational seed data:
-- - All models and model dependencies
-- - All agents and agent dependencies
-- - Default prompts (not linked to departments)

-- Load schema first: psql "$DB_URL" < schema.sql
-- Then load this: psql "$DB_URL" < base.sql

EOF
    
    echo "Step 1: Exporting models and dependencies..."
    
    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- MODELS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    
    echo "  - All models..."
    export_table_all "models" "$OUTPUT_FILE"
    
    echo "  - Model dependencies..."
    # NOTE: Excluding model_departments (department-agnostic)
    export_table_all "model_endpoints" "$OUTPUT_FILE"
    export_table_all "model_modalities" "$OUTPUT_FILE"
    export_table_all "model_pricing" "$OUTPUT_FILE"
    export_table_all "model_qualities" "$OUTPUT_FILE"
    export_table_all "model_reasoning_levels" "$OUTPUT_FILE"
    export_table_all "model_temperature_levels" "$OUTPUT_FILE"
    export_table_all "model_voices" "$OUTPUT_FILE"
    
    echo "Step 2: Exporting prompts..."
    
    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- PROMPTS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    
    echo "  - Default prompts (not linked to departments)..."
    # Only export prompts that are:
    # 1. NOT linked via agent_department_prompts (ternary table)
    # 2. NOT department-specific by name (exclude prompts with department names)
    psql "$DB_URL" -t -A -c "
        SELECT 'INSERT INTO public.prompts VALUES (' ||
            quote_literal(created_at) || ',' ||
            quote_literal(updated_at) || ',' ||
            quote_literal(system_prompt) || ',' ||
            quote_literal(name) || ',' ||
            quote_literal(description) || ',' ||
            quote_literal(active) || ',' ||
            quote_literal(id) || ');'
        FROM prompts 
        WHERE id NOT IN (SELECT DISTINCT prompt_id FROM agent_department_prompts WHERE prompt_id IS NOT NULL)
        AND name NOT ILIKE '%statistics%'
        AND name NOT ILIKE '%physics%'
        AND name NOT ILIKE '%mathematics%'
        AND name NOT ILIKE '%math%'
        AND name NOT ILIKE '%chemistry%'
        AND name NOT ILIKE '%chem%'
        AND name NOT ILIKE '%biology%'
        AND name NOT ILIKE '%cs%'
        AND name NOT ILIKE '%computer science%'
        AND name NOT ILIKE '%earth%'
        AND name NOT ILIKE '%eaps%';
    " >> "$OUTPUT_FILE" 2>/dev/null || true
    
    echo "Step 3: Exporting agents and dependencies..."
    
    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- AGENTS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    
    echo "  - All agents..."
    export_table_all "agents" "$OUTPUT_FILE"
    
    echo "  - Agent dependencies..."
    # Only export agent-prompt links for default prompts (not in agent_department_prompts and not department-specific by name)
    DEFAULT_PROMPT_IDS=$(psql "$DB_URL" -t -A -c "
        SELECT string_agg(id::text, ',') FROM prompts 
        WHERE id NOT IN (SELECT DISTINCT prompt_id FROM agent_department_prompts WHERE prompt_id IS NOT NULL)
        AND name NOT ILIKE '%statistics%'
        AND name NOT ILIKE '%physics%'
        AND name NOT ILIKE '%mathematics%'
        AND name NOT ILIKE '%math%'
        AND name NOT ILIKE '%chemistry%'
        AND name NOT ILIKE '%chem%'
        AND name NOT ILIKE '%biology%'
        AND name NOT ILIKE '%cs%'
        AND name NOT ILIKE '%computer science%'
        AND name NOT ILIKE '%earth%'
        AND name NOT ILIKE '%eaps%';
    " 2>/dev/null || echo "")
    if [ -n "$DEFAULT_PROMPT_IDS" ] && [ "$DEFAULT_PROMPT_IDS" != "" ]; then
        DEFAULT_PROMPT_IDS_SQL=$(echo "$DEFAULT_PROMPT_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
        export_table_where "agent_prompts" "prompt_id IN ($DEFAULT_PROMPT_IDS_SQL)" "$OUTPUT_FILE"
    else
        echo "    Warning: No default prompts found"
    fi
    # NOTE: Excluding agent_departments and agent_department_prompts (department-agnostic)
    export_table_all "agent_reasoning_levels" "$OUTPUT_FILE"
    export_table_all "agent_temperature_levels" "$OUTPUT_FILE"
    export_table_all "agent_voices" "$OUTPUT_FILE"
    
    echo ""
    echo "Done! Generated $OUTPUT_FILE"
    echo "Total INSERT statements: $(grep -c 'INSERT INTO' "$OUTPUT_FILE" 2>/dev/null || echo 0)"
}

# Institution seed export function (shared for university/organization)
export_institution() {
    local type=$1  # "university" or "organization"
    local OUTPUT_FILE="${type}.sql"
    
    echo "Generating ${OUTPUT_FILE} seed file..."
    
    # Start with header
    if [ "$type" = "university" ]; then
        cat > "$OUTPUT_FILE" << 'EOF'
-- University Seed Data
-- This file contains the minimal seed data for a university setup:
-- - Practice simulations and their scenarios
-- - All dependencies (fields, parameters, personas)
-- - Default profiles (not in any department)
-- - All personas

-- Load schema first: psql "$DB_URL" < schema.sql
-- Then load base: psql "$DB_URL" < base.sql
-- Then load this: psql "$DB_URL" < university.sql

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
    echo "Step 1: Exporting base entities..."
    
    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- BASE ENTITIES" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    
    echo "  - Default profiles (not in any department)..."
    # Generate INSERT statements directly using SQL (profiles has first_name, last_name, not name)
    psql "$DB_URL" -t -A -c "
        SELECT 'INSERT INTO public.profiles VALUES (' ||
            quote_literal(updated_at) || ',' ||
            quote_literal(last_login) || ',' ||
            quote_literal(first_name) || ',' ||
            quote_literal(last_name) || ',' ||
            quote_literal(created_at) || ',' ||
            quote_literal(role) || ',' ||
            quote_literal(active) || ',' ||
            quote_literal(id) || ');'
        FROM profiles WHERE id NOT IN (SELECT DISTINCT profile_id FROM profile_departments WHERE profile_id IS NOT NULL);
    " >> "$OUTPUT_FILE" 2>/dev/null || true
    
    echo "  - All personas..."
    export_table_all "personas" "$OUTPUT_FILE"
    
    echo "Step 2: Finding practice simulations and dependencies..."
    
    # Get IDs for practice simulations  
    PRACTICE_SIM_IDS=$(psql "$DB_URL" -t -A -c "SELECT string_agg(id::text, ',') FROM simulations WHERE practice_simulation = true;")
    PRACTICE_SIM_IDS_SQL=$(echo "$PRACTICE_SIM_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
    
    if [ -z "$PRACTICE_SIM_IDS" ] || [ "$PRACTICE_SIM_IDS" = "" ]; then
        echo "ERROR: No practice simulations found!"
        exit 1
    fi
    
    echo "  Found practice simulations"
    
    # Get scenario IDs for practice simulations
    SCENARIO_IDS=$(psql "$DB_URL" -t -A -c "
        SELECT string_agg(DISTINCT scenario_id::text, ',') 
        FROM simulation_scenarios 
        WHERE simulation_id IN (SELECT id FROM simulations WHERE practice_simulation = true);
    ")
    
    # Format scenario IDs for SQL
    if [ -n "$SCENARIO_IDS" ] && [ "$SCENARIO_IDS" != "" ]; then
        SCENARIO_IDS_SQL=$(echo "$SCENARIO_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
    else
        SCENARIO_IDS_SQL=""
    fi
    
    echo "Step 3: Exporting scenarios for practice simulations..."
    
    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- SCENARIOS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    
    if [ -n "$SCENARIO_IDS" ] && [ "$SCENARIO_IDS" != "" ]; then
        echo "  - Scenarios for practice simulations..."
        # Format IDs as UUID list for SQL
        SCENARIO_IDS_SQL=$(echo "$SCENARIO_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
        # Generate INSERT statements directly using SQL (faster than pg_dump for filtered data)
        psql "$DB_URL" -t -A -c "
            SELECT 'INSERT INTO public.scenarios VALUES (' ||
                quote_literal(created_at) || ',' ||
                quote_literal(updated_at) || ',' ||
                quote_literal(name) || ',' ||
                quote_literal(generated) || ',' ||
                quote_literal(active) || ',' ||
                quote_literal(objectives_enabled) || ',' ||
                quote_literal(images_enabled) || ',' ||
                quote_literal(video_enabled) || ',' ||
                quote_literal(questions_enabled) || ',' ||
                quote_literal(description) || ',' ||
                quote_literal(id) || ',' ||
                quote_literal(scenario_agent_id) || ',' ||
                quote_literal(video_agent_id) || ',' ||
                quote_literal(image_agent_id) || ');'
            FROM scenarios WHERE id IN ($SCENARIO_IDS_SQL);
        " >> "$OUTPUT_FILE" 2>/dev/null || true
        
        echo "  - Scenario dependencies (only for exported scenarios)..."
        # Only export scenario dependencies for the scenarios we're actually exporting
        # NOTE: Excluding scenario_departments (department-agnostic)
        export_table_where "scenario_fields" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_parameters" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_documents" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_images" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_videos" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_objectives" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_questions" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_personas" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_problem_statements" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_field_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_parameter_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_persona_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_document_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_time_limits" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "scenario_groups" "scenario_id IN ($SCENARIO_IDS_SQL)" "$OUTPUT_FILE"
        # Skip scenario_tree - complex query that may hang, and not critical for seed data
        # export_table_where "scenario_tree" "(scenario_id IN ($SCENARIO_IDS_SQL) OR parent_id IN ($SCENARIO_IDS_SQL) OR child_id IN ($SCENARIO_IDS_SQL))"
    fi
    
    echo "Step 4: Exporting practice simulations..."
    
    echo "" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    echo "-- SIMULATIONS" >> "$OUTPUT_FILE"
    echo "-- ========================================" >> "$OUTPUT_FILE"
    
    echo "  - Practice simulations..."
    # Generate INSERT statements directly using SQL (matching table column order)
    # Handle NULL UUIDs properly by casting to text first
    psql "$DB_URL" -t -A -c "
        SELECT 'INSERT INTO public.simulations VALUES (' ||
            quote_literal(created_at) || ',' ||
            quote_literal(updated_at) || ',' ||
            quote_literal(title) || ',' ||
            quote_literal(description) || ',' ||
            quote_literal(active) || ',' ||
            quote_literal(practice_simulation) || ',' ||
            COALESCE(quote_literal(grade_voice_agent_id::text), 'NULL') || ',' ||
            quote_literal(id) || ',' ||
            quote_literal(simulation_text_agent_id) || ',' ||
            COALESCE(quote_literal(simulation_voice_agent_id::text), 'NULL') || ',' ||
            quote_literal(hint_agent_id) || ',' ||
            quote_literal(grade_text_agent_id) || ');'
        FROM simulations WHERE practice_simulation = true;
    " >> "$OUTPUT_FILE" 2>/dev/null || true
    
    echo "  - Simulation dependencies..."
    # NOTE: Excluding simulation_departments (department-agnostic)
    export_table_where "simulation_scenarios" "simulation_id IN ($PRACTICE_SIM_IDS_SQL)" "$OUTPUT_FILE"
    export_table_where "simulation_hints" "simulation_id IN ($PRACTICE_SIM_IDS_SQL)" "$OUTPUT_FILE"
    
    echo "Step 5: Exporting remaining dependencies..."
    
    # Persona dependencies
    # NOTE: Excluding persona_departments (department-agnostic)
    export_table_all "persona_fields" "$OUTPUT_FILE"
    export_table_all "persona_examples" "$OUTPUT_FILE"
    
    # Field and parameter dependencies (for scenarios)
    if [ -n "$SCENARIO_IDS" ] && [ "$SCENARIO_IDS" != "" ]; then
        FIELD_IDS=$(psql "$DB_URL" -t -A -c "SELECT string_agg(DISTINCT field_id::text, ',') FROM scenario_fields WHERE scenario_id IN ($SCENARIO_IDS);" 2>/dev/null || echo "")
        PARAM_IDS=$(psql "$DB_URL" -t -A -c "SELECT string_agg(DISTINCT parameter_id::text, ',') FROM scenario_parameters WHERE scenario_id IN ($SCENARIO_IDS);" 2>/dev/null || echo "")
        
        if [ -n "$FIELD_IDS" ] && [ "$FIELD_IDS" != "" ]; then
            FIELD_IDS_SQL=$(echo "$FIELD_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
            # NOTE: Excluding field_departments (department-agnostic)
            export_table_where "field_conditional_parameters" "field_id IN ($FIELD_IDS_SQL)" "$OUTPUT_FILE"
            export_table_where "fields" "id IN ($FIELD_IDS_SQL)" "$OUTPUT_FILE"
        fi
        
        if [ -n "$PARAM_IDS" ] && [ "$PARAM_IDS" != "" ]; then
            PARAM_IDS_SQL=$(echo "$PARAM_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
            # NOTE: Excluding parameter_departments (department-agnostic)
            export_table_where "parameter_fields" "parameter_id IN ($PARAM_IDS_SQL)" "$OUTPUT_FILE"
            export_table_where "parameters" "id IN ($PARAM_IDS_SQL)" "$OUTPUT_FILE"
        fi
    fi
    
    # Department dependencies
    DEPT_IDS=$(psql "$DB_URL" -t -A -c "
        SELECT string_agg(DISTINCT id::text, ',') FROM departments WHERE id IN (
            SELECT department_id FROM simulation_departments WHERE simulation_id IN ($PRACTICE_SIM_IDS_SQL)
            UNION SELECT department_id FROM scenario_departments WHERE scenario_id IN ($SCENARIO_IDS_SQL)
        );
    " 2>/dev/null || echo "")
    
    if [ -n "$DEPT_IDS" ] && [ "$DEPT_IDS" != "" ]; then
        DEPT_IDS_SQL=$(echo "$DEPT_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
        export_table_where "departments" "id IN ($DEPT_IDS_SQL)" "$OUTPUT_FILE"
    fi
    
    # Settings dependencies
    export_table_all "settings_default_account" "$OUTPUT_FILE"
    export_table_all "settings_default_department" "$OUTPUT_FILE"
    export_table_all "settings_default_guest" "$OUTPUT_FILE"
    export_table_all "setting_auths" "$OUTPUT_FILE"
    export_table_all "setting_auth_keys" "$OUTPUT_FILE"
    export_table_all "setting_auth_values" "$OUTPUT_FILE"
    export_table_all "setting_providers" "$OUTPUT_FILE"
    export_table_all "setting_provider_keys" "$OUTPUT_FILE"
    export_table_all "department_settings" "$OUTPUT_FILE"
    
    # Profile dependencies for default profiles
    DEFAULT_PROFILE_IDS=$(psql "$DB_URL" -t -A -c "SELECT string_agg(id::text, ',') FROM profiles WHERE id NOT IN (SELECT DISTINCT profile_id FROM profile_departments WHERE profile_id IS NOT NULL);" 2>/dev/null || echo "")
    
    if [ -n "$DEFAULT_PROFILE_IDS" ] && [ "$DEFAULT_PROFILE_IDS" != "" ]; then
        DEFAULT_PROFILE_IDS_SQL=$(echo "$DEFAULT_PROFILE_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
        export_table_where "profile_departments" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "profile_emails" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "profile_request_limits" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)" "$OUTPUT_FILE"
        export_table_where "profile_activity" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)" "$OUTPUT_FILE"
    fi
    
    # Prompt dependencies
    export_table_all "prompt_departments" "$OUTPUT_FILE"
    
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
        echo "  base         - Export base seed data (models, agents, default prompts)"
        echo "  university   - Export university seed data (practice simulations, scenarios, etc.)"
        echo "  organization - Export organization seed data (currently no-op)"
        exit 1
        ;;
esac

