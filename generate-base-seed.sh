#!/bin/bash
set -euo pipefail

# Database connection
DB_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
OUTPUT_FILE="base.sql"
PG_DUMP="/opt/homebrew/opt/postgresql@18/bin/pg_dump"

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

echo "Step 1: Exporting models and dependencies..."

echo "" >> "$OUTPUT_FILE"
echo "-- ========================================" >> "$OUTPUT_FILE"
echo "-- MODELS" >> "$OUTPUT_FILE"
echo "-- ========================================" >> "$OUTPUT_FILE"

echo "  - All models..."
export_table_all "models"

echo "  - Model dependencies..."
# NOTE: Excluding model_departments (department-agnostic)
export_table_all "model_endpoints"
export_table_all "model_modalities"
export_table_all "model_pricing"
export_table_all "model_qualities"
export_table_all "model_reasoning_levels"
export_table_all "model_temperature_levels"
export_table_all "model_voices"

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
export_table_all "agents"

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
    export_table_where "agent_prompts" "prompt_id IN ($DEFAULT_PROMPT_IDS_SQL)"
else
    echo "    Warning: No default prompts found"
fi
# NOTE: Excluding agent_departments and agent_department_prompts (department-agnostic)
export_table_all "agent_reasoning_levels"
export_table_all "agent_temperature_levels"
export_table_all "agent_voices"

echo ""
echo "Done! Generated $OUTPUT_FILE"
echo "Total INSERT statements: $(grep -c 'INSERT INTO' "$OUTPUT_FILE" 2>/dev/null || echo 0)"

