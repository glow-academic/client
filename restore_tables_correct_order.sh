#!/bin/bash
set -euo pipefail

# Database connection details
DB_USER="myuser"
DB_PASSWORD="mypassword"
DB_NAME="mydb"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_FILE="/Users/ashoksaravanan/Coding/glow/history/database_backup_20250911_133356.sql"

# Set password for psql
export PGPASSWORD="$DB_PASSWORD"

# Tables ordered by exact dependency from init.sql files
# Based on the foreign key relationships in the init files
TABLES_ORDER=(
    # 1. Independent tables (no foreign key dependencies)
    "verification_token"
    "accounts"
    "sessions"
    "users"
    
    # 2. Providers and models (providers first, then models)
    "providers"
    "models"
    
    # 3. Documents (independent)
    "documents"
    
    # 4. Rubrics and standards (rubrics first, then standard_groups, then standards)
    "rubrics"
    "standard_groups"
    "standards"
    
    # 5. System tables (parameters first, then parameter_items)
    "parameters"
    "parameter_items"
    # "app_logs"  # Skipped - very large table
    
    # 6. Profiles (depends on users)
    "profiles"
    
    # 7. Assistant tables (depends on profiles)
    "assistant_chats"
    "assistant_messages"
    "assistant_tool_calls"
    
    # 8. Personas (depends on models)
    "personas"
    
    # 9. Agents (depends on models)
    "agents"
    
    # 10. Scenarios (depends on personas, parameter_items, documents)
    "scenarios"
    
    # 11. Simulations (depends on scenarios, rubrics)
    "simulations"
    
    # 12. Cohorts (depends on profiles, simulations)
    "cohorts"
    
    # 13. Model runs (depends on models, personas, agents, profiles)
    "model_runs"
    
    # 14. Debug info (depends on model_runs)
    "debug_info"
    
    # 15. Simulation attempts (depends on profiles, simulations)
    "simulation_attempts"
    
    # 16. Simulation chats (depends on scenarios, simulation_attempts)
    "simulation_chats"
    
    # 17. Simulation messages (depends on simulation_chats)
    "simulation_messages"
    
    # 18. Simulation crowdsourced messages (depends on simulation_messages, profiles)
    "simulation_crowdsourced_messages"
    
    # 19. Simulation chat grades (depends on rubrics, simulation_chats)
    "simulation_chat_grades"
    
    # 20. Simulation chat feedbacks (depends on standards, simulation_chat_grades)
    "simulation_chat_feedbacks"
    
    # 21. Simulation chat crowdsourced feedbacks (depends on simulation_chat_feedbacks, profiles)
    "simulation_chat_crowdsourced_feedbacks"
    
    # 22. App feedback (depends on profiles)
    "app_feedback"
)

echo "🔄 Starting table restoration process (correct dependency order)..."
echo "📁 Using backup: $(basename "$BACKUP_FILE")"
echo ""

# Function to extract and restore a single table
restore_table() {
    local table_name="$1"
    echo "🔄 Processing table: $table_name"
    
    # Clear the existing table
    echo "  🗑️  Clearing table: $table_name"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "TRUNCATE TABLE public.$table_name CASCADE;" 2>/dev/null || {
        echo "    ⚠️  Failed to clear $table_name, continuing..."
    }
    
    # Extract the table data from backup and restore it
    echo "  📥 Restoring data for table: $table_name"
    
    # Create a temporary file for this table's data
    temp_file="/tmp/restore_${table_name}.sql"
    
    # Extract only the COPY data from the backup
    awk "
    /^COPY public\.${table_name} \(/,/^\\\.$/ { print }
    " "$BACKUP_FILE" > "$temp_file"
    
    # Check if we found data for this table
    if [[ -s "$temp_file" ]] && grep -q "COPY public\.${table_name}" "$temp_file"; then
        # Restore the table data
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$temp_file" 2>/dev/null; then
            count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM public.$table_name;" 2>/dev/null || echo "0")
            echo "    ✅ Restored $count rows"
        else
            echo "    ⚠️  Failed to restore data (checking for foreign key issues)"
            count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM public.$table_name;" 2>/dev/null || echo "0")
            echo "    📊 Current row count: $count"
        fi
    else
        echo "    📝 No data found (empty table)"
    fi
    
    # Clean up temporary file
    rm -f "$temp_file"
    echo ""
}

# Process each table in dependency order
for table in "${TABLES_ORDER[@]}"; do
    restore_table "$table"
done

echo "✅ Table restoration process completed!"
echo ""
echo "📊 Final row counts:"
for table in "${TABLES_ORDER[@]}"; do
    count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM public.$table;" 2>/dev/null || echo "0")
    echo "  - $table: $count rows"
done
