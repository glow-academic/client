#!/bin/bash
set -euo pipefail

# Database connection details
DB_USER="myuser"
DB_PASSWORD="mypassword"
DB_NAME="mydb"
DB_HOST="localhost"
DB_PORT="5432"

# File paths
BACKUP_FILE="/Users/ashoksaravanan/Coding/glow/history/database_backup_20250911_133356.sql"
MIGRATION_FILE="/Users/ashoksaravanan/Coding/glow/apply_department_migration.sql"
OUTPUT_BACKUP="/Users/ashoksaravanan/Coding/glow/history/department_backup.sql"

# Set password for psql
export PGPASSWORD="$DB_PASSWORD"

echo "🔄 Starting department migration process..."
echo "📁 Source backup: $(basename "$BACKUP_FILE")"
echo "📁 Migration file: $(basename "$MIGRATION_FILE")"
echo "📁 Output backup: $(basename "$OUTPUT_BACKUP")"
echo ""

# Function to check if database exists
check_database() {
    echo "🔍 Checking if database '$DB_NAME' exists..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "\l" | grep -q "$DB_NAME"; then
        echo "  ✅ Database '$DB_NAME' exists"
        return 0
    else
        echo "  ❌ Database '$DB_NAME' does not exist"
        return 1
    fi
}

# Function to create database if it doesn't exist
create_database() {
    echo "🔄 Creating database '$DB_NAME'..."
    if createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null; then
        echo "  ✅ Database '$DB_NAME' created successfully"
    else
        echo "  ⚠️  Database creation failed or already exists"
    fi
}

# Function to drop and recreate database
recreate_database() {
    echo "🗑️  Dropping and recreating database..."
    
    # Drop database if it exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null; then
        echo "  ✅ Database dropped successfully"
    else
        echo "  ⚠️  Failed to drop database, continuing..."
    fi
    
    # Create new database
    if createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null; then
        echo "  ✅ Database created successfully"
    else
        echo "  ❌ Failed to create database"
        return 1
    fi
}

# Function to load backup
load_backup() {
    echo "📥 Loading database backup..."
    echo "  📁 Source: $(basename "$BACKUP_FILE")"
    
    # Remove restrict commands that might cause issues
    if sed '/\\restrict/d' "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" 2>/dev/null; then
        echo "  ✅ Backup loaded successfully"
    else
        echo "  ❌ Failed to load backup"
        return 1
    fi
}

# Function to apply migration
apply_migration() {
    echo "🔧 Applying department migration..."
    echo "  📁 Migration: $(basename "$MIGRATION_FILE")"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE" 2>/dev/null; then
        echo "  ✅ Migration applied successfully"
    else
        echo "  ❌ Failed to apply migration"
        return 1
    fi
}

# Function to create new backup
create_backup() {
    echo "💾 Creating new backup..."
    echo "  📁 Output: $(basename "$OUTPUT_BACKUP")"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$OUTPUT_BACKUP" 2>/dev/null; then
        echo "  ✅ New backup created successfully"
        echo "  📊 Backup size: $(du -h "$OUTPUT_BACKUP" | cut -f1)"
    else
        echo "  ❌ Failed to create backup"
        return 1
    fi
}

# Function to verify migration results
verify_migration() {
    echo "🔍 Verifying migration results..."
    
    # Check if departments table exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt" | grep -q "departments"; then
        echo "  ✅ Departments table created"
        
        # Count departments
        dept_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM departments;" 2>/dev/null || echo "0")
        echo "  📊 Departments: $dept_count"
        
        # Check if department_id columns were added
        tables_with_dept=("profiles" "simulations" "rubrics" "cohorts" "documents" "providers" "scenarios" "personas" "model_runs" "parameters")
        dept_columns_added=0
        
        for table in "${tables_with_dept[@]}"; do
            if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d $table" | grep -q "department_id"; then
                ((dept_columns_added++))
            fi
        done
        
        echo "  📊 Tables with department_id: $dept_columns_added/${#tables_with_dept[@]}"
        
        if [ "$dept_columns_added" -eq "${#tables_with_dept[@]}" ]; then
            echo "  ✅ All department_id columns added successfully"
        else
            echo "  ⚠️  Some department_id columns may be missing"
        fi
    else
        echo "  ❌ Departments table not found"
        return 1
    fi
}

# Main execution
main() {
    echo "🚀 Starting department migration process..."
    echo ""
    
    # Step 1: Drop and recreate database
    if ! recreate_database; then
        echo "❌ Failed to recreate database. Exiting."
        exit 1
    fi
    
    # Step 2: Load backup
    if ! load_backup; then
        echo "❌ Failed to load backup. Exiting."
        exit 1
    fi
    
    # Step 3: Apply migration
    if ! apply_migration; then
        echo "❌ Failed to apply migration. Exiting."
        exit 1
    fi
    
    # Step 4: Create new backup
    if ! create_backup; then
        echo "❌ Failed to create backup. Exiting."
        exit 1
    fi
    
    # Step 5: Verify results
    verify_migration
    
    echo ""
    echo "✅ Department migration process completed successfully!"
    echo "📁 New backup saved as: $(basename "$OUTPUT_BACKUP")"
    echo ""
    echo "📊 Summary:"
    echo "  - Source backup: $(basename "$BACKUP_FILE")"
    echo "  - Migration applied: $(basename "$MIGRATION_FILE")"
    echo "  - New backup: $(basename "$OUTPUT_BACKUP")"
    echo "  - Database: $DB_NAME"
}

# Run main function
main "$@"
