#!/bin/bash
set -euo pipefail

# Database connection
DB_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
OUTPUT_FILE="university.sql"
PG_DUMP="/opt/homebrew/opt/postgresql@18/bin/pg_dump"

echo "Generating university.sql seed file..."

# Start with header
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

# Function to export table with WHERE clause using temporary view
export_table_where() {
    local table=$1
    local where=$2
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
            sed "s/INSERT INTO public.$temp_view/INSERT INTO public.$table/" >> "$OUTPUT_FILE" || true
    else
        $PG_DUMP --data-only --inserts --exclude-schema=keycloak --table="public.$temp_view" --format=plain "$DB_URL" 2>/dev/null | \
            grep "^INSERT INTO" | \
            sed "s/INSERT INTO public.$temp_view/INSERT INTO public.$table/" >> "$OUTPUT_FILE" || true
    fi
    
    # Drop temporary view
    psql "$DB_URL" -c "DROP VIEW IF EXISTS $temp_view;" > /dev/null 2>&1
}

# Function to export entire table
export_table_all() {
    local table=$1
    $PG_DUMP --data-only --inserts --exclude-schema=keycloak --table="public.$table" --format=plain "$DB_URL" 2>/dev/null | \
        grep "^INSERT INTO" >> "$OUTPUT_FILE" || true
}

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
export_table_all "personas"

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
    export_table_where "scenario_fields" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_parameters" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_documents" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_images" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_videos" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_objectives" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_questions" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_personas" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_problem_statements" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_field_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_parameter_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_persona_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_document_ranges" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_time_limits" "scenario_id IN ($SCENARIO_IDS_SQL)"
    export_table_where "scenario_groups" "scenario_id IN ($SCENARIO_IDS_SQL)"
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
export_table_where "simulation_scenarios" "simulation_id IN ($PRACTICE_SIM_IDS_SQL)"
export_table_where "simulation_hints" "simulation_id IN ($PRACTICE_SIM_IDS_SQL)"

echo "Step 5: Exporting remaining dependencies..."

# Persona dependencies
# NOTE: Excluding persona_departments (department-agnostic)
export_table_all "persona_fields"
export_table_all "persona_examples"

# Field and parameter dependencies (for scenarios)
if [ -n "$SCENARIO_IDS" ] && [ "$SCENARIO_IDS" != "" ]; then
    FIELD_IDS=$(psql "$DB_URL" -t -A -c "SELECT string_agg(DISTINCT field_id::text, ',') FROM scenario_fields WHERE scenario_id IN ($SCENARIO_IDS);" 2>/dev/null || echo "")
    PARAM_IDS=$(psql "$DB_URL" -t -A -c "SELECT string_agg(DISTINCT parameter_id::text, ',') FROM scenario_parameters WHERE scenario_id IN ($SCENARIO_IDS);" 2>/dev/null || echo "")
    
    if [ -n "$FIELD_IDS" ] && [ "$FIELD_IDS" != "" ]; then
        FIELD_IDS_SQL=$(echo "$FIELD_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
        # NOTE: Excluding field_departments (department-agnostic)
        export_table_where "field_conditional_parameters" "field_id IN ($FIELD_IDS_SQL)"
        export_table_where "fields" "id IN ($FIELD_IDS_SQL)"
    fi
    
    if [ -n "$PARAM_IDS" ] && [ "$PARAM_IDS" != "" ]; then
        PARAM_IDS_SQL=$(echo "$PARAM_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
        # NOTE: Excluding parameter_departments (department-agnostic)
        export_table_where "parameter_fields" "parameter_id IN ($PARAM_IDS_SQL)"
        export_table_where "parameters" "id IN ($PARAM_IDS_SQL)"
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
    export_table_where "departments" "id IN ($DEPT_IDS_SQL)"
fi

# Settings dependencies
export_table_all "settings_default_account"
export_table_all "settings_default_department"
export_table_all "settings_default_guest"
export_table_all "setting_auths"
export_table_all "setting_auth_keys"
export_table_all "setting_auth_values"
export_table_all "setting_providers"
export_table_all "setting_provider_keys"
export_table_all "department_settings"

# Profile dependencies for default profiles
DEFAULT_PROFILE_IDS=$(psql "$DB_URL" -t -A -c "SELECT string_agg(id::text, ',') FROM profiles WHERE id NOT IN (SELECT DISTINCT profile_id FROM profile_departments WHERE profile_id IS NOT NULL);" 2>/dev/null || echo "")

if [ -n "$DEFAULT_PROFILE_IDS" ] && [ "$DEFAULT_PROFILE_IDS" != "" ]; then
    DEFAULT_PROFILE_IDS_SQL=$(echo "$DEFAULT_PROFILE_IDS" | sed "s/,/','/g" | sed "s/^/'/" | sed "s/$/'/")
    export_table_where "profile_departments" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)"
    export_table_where "profile_emails" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)"
    export_table_where "profile_request_limits" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)"
    export_table_where "profile_activity" "profile_id IN ($DEFAULT_PROFILE_IDS_SQL)"
fi

# Prompt dependencies
export_table_all "prompt_departments"

echo ""
echo "Done! Generated $OUTPUT_FILE"
echo "File size: $(du -h $OUTPUT_FILE | cut -f1)"
echo "Line count: $(wc -l < $OUTPUT_FILE)"
