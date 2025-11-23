#!/usr/bin/env bash
set -euo pipefail

# --- LOAD .env -------------------------------------------------------
# put KEY=value pairs (no quotes) in ../.env
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${script_dir}/../.env" ]]; then
  set -a                # export every sourced var
  source "${script_dir}/../.env"
  set +a
fi

# --- CONFIG ----------------------------------------------------------
DB_USER=${DB_USER:-myuser}
DB_PASSWORD=${DB_PASSWORD:-mypassword}
DB_NAME=${DB_NAME:-mydb}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
# Use root history folder (one level up from database/)
HISTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/history"
mkdir -p "$HISTORY_DIR"

# Parse command line arguments
CLEAN_DB=false
MIGRATE_DB=false
MIGRATE_ALL=false
CONNECT_DB=false

for arg in "$@"; do
  case $arg in
    --clean)
      CLEAN_DB=true
      shift
      ;;
    --migrate)
      MIGRATE_DB=true
      shift
      ;;
    --migrate-all|--all)
      MIGRATE_DB=true
      MIGRATE_ALL=true
      shift
      ;;
    --connect)
      CONNECT_DB=true
      shift
      ;;
    *)
      # Check if --migrate was already set and this is --all
      if [[ "$MIGRATE_DB" == true ]] && [[ "$arg" == "--all" ]]; then
        MIGRATE_ALL=true
        shift
      else
        echo "Usage: $0 [--clean|--migrate [--all]|--migrate-all|--connect]"
        echo "  --clean       : Create backup, then start fresh database from init.sql"
        echo "  --migrate     : Apply most recent migration from migrate/ folder"
        echo "  --migrate --all or --migrate-all : Apply all migrations from migrate/ folder"
        echo "  --connect     : Connect to existing database"
        echo "  (default)     : Start from latest backup (no migrations)"
        exit 1
      fi
      ;;
  esac
done

ADMIN_CONN="postgresql://postgres@${DB_HOST}:${DB_PORT}/postgres"
USER_CONN="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
INIT_SQL=${INIT_SQL:-app/init.sql}

# --- CHECK POSTGRESQL ------------------------------------------------
if ! command -v psql &>/dev/null; then
  echo "❌ PostgreSQL client not found!"
  echo "Please install PostgreSQL first:"
  echo "  macOS: brew install postgresql@15"
  echo "  Ubuntu: sudo apt-get install postgresql postgresql-contrib"
  echo "  CentOS: sudo yum install postgresql-server postgresql-contrib"
  exit 1
fi

# Ensure server is running ---------------------------------------------
if ! pg_isready -q; then
  echo "❌ PostgreSQL server is not running!"
  echo "Please start PostgreSQL first:"
  echo "  macOS: brew services start postgresql@15"
  echo "  Linux: sudo systemctl start postgresql"
  exit 1
fi

# --- HELPERS ---------------------------------------------------------
as_admin()    { psql "$ADMIN_CONN" -qtA "$@"; }
role_exists() { as_admin -c "SELECT 1 FROM pg_roles    WHERE rolname='$DB_USER';" | grep -q 1; }
db_exists()   { as_admin -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -q 1; }

# Function to extract migration number from filename
# Example: "10_cleanup_prompt_agent_names.sql" -> "10"
extract_migration_number() {
  local filename=$(basename "$1")
  # Extract number from start of filename (e.g., "10_" -> "10")
  if [[ "$filename" =~ ^([0-9]+)_ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

# Function to delete old backups with same migration number prefix
delete_old_migration_backups() {
  local migration_num="$1"
  if [[ -z "$migration_num" ]]; then
    return 0
  fi
  
  # Find and delete old backups with this migration number
  local old_backups=$(ls "$HISTORY_DIR"/restore_${migration_num}_*.sql.gz 2>/dev/null || true)
  if [[ -n "$old_backups" ]]; then
    echo "🗑️  Deleting old backups for migration $migration_num..."
    for old_backup in $old_backups; do
      echo "   Removing: $(basename "$old_backup")"
      rm -f "$old_backup"
    done
  fi
}

# Function to create backup
# Usage: create_backup [migration_number]
# If migration_number is provided, backup will be prefixed with it (e.g., restore_10_YYYYMMDD_HHMMSS.sql.gz)
create_backup() {
  local migration_num="${1:-}"
  
  # Only create backup if database exists and has data
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    # Check if there are any tables with data
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    " 2>/dev/null || echo "0")
    
    if [[ "$table_count" -gt 0 ]]; then
      local timestamp=$(date +"%Y%m%d_%H%M%S")
      local backup_file
      
      # Delete old backups with same migration number if provided
      if [[ -n "$migration_num" ]]; then
        delete_old_migration_backups "$migration_num"
        backup_file="$HISTORY_DIR/restore_${migration_num}_${timestamp}.sql.gz"
      else
        backup_file="$HISTORY_DIR/restore_${timestamp}.sql.gz"
      fi
      
      echo "📦 Backup saved → $(basename "$backup_file")"
      
      # Create compressed backup
      pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
        -F c -f "$backup_file" 2>/dev/null || {
        echo "⚠️  Backup creation had issues, but continuing..."
        touch "$backup_file"  # Create empty file so script doesn't fail
      }
    else
      echo "📝 No data to backup - skipping backup creation"
    fi
  else
    echo "📝 No database to backup - skipping backup creation"
  fi
}

# Function to get latest backup
# Handles both old format (restore_TIMESTAMP.sql.gz) and new format (restore_MIGRATIONNUM_TIMESTAMP.sql.gz)
get_latest_backup() {
  # Check if history directory exists and has restore files
  if [[ -d "$HISTORY_DIR" ]] && ls "$HISTORY_DIR"/restore_*.sql.gz 1> /dev/null 2>&1; then
    # Get the most recent backup by modification time (works for both formats)
    ls -t "$HISTORY_DIR"/restore_*.sql.gz 2>/dev/null | head -1
  else
    # Return empty string if no backups found
    echo ""
  fi
}

# Function to get backup for a specific migration number
# Finds the most recent backup file matching restore_{migration_num}_*.sql.gz
get_backup_for_migration() {
  local migration_num="$1"
  if [[ -z "$migration_num" ]]; then
    echo ""
    return
  fi
  
  # Check if history directory exists and has restore files for this migration
  if [[ -d "$HISTORY_DIR" ]] && ls "$HISTORY_DIR"/restore_${migration_num}_*.sql.gz 1> /dev/null 2>&1; then
    # Get the most recent backup by modification time for this migration number
    ls -t "$HISTORY_DIR"/restore_${migration_num}_*.sql.gz 2>/dev/null | head -1
  else
    # Return empty string if no backup found for this migration
    echo ""
  fi
}

# Function to get backup for the previous migration
# Takes current migration number and finds backup for (current - 1)
# Falls back to get_latest_backup() if no previous migration backup found
get_previous_migration_backup() {
  local current_migration_num="$1"
  if [[ -z "$current_migration_num" ]] || [[ "$current_migration_num" -le 0 ]]; then
    # If no valid migration number, fall back to latest backup
    get_latest_backup
    return
  fi
  
  # Calculate previous migration number
  local previous_migration_num=$((current_migration_num - 1))
  
  # Try to find backup for previous migration
  local previous_backup=$(get_backup_for_migration "$previous_migration_num")
  
  if [[ -n "$previous_backup" ]]; then
    echo "$previous_backup"
  else
    # Fall back to latest backup if no previous migration backup found
    get_latest_backup
  fi
}

setup_database() {
  echo "🔧 Setting up database and user..."
  
  if ! role_exists; then
    echo "👤 Creating user '$DB_USER'..."
    as_admin -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
  fi
  
  if db_exists; then
    echo "🗑️  Dropping existing database..."
    as_admin -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1
    as_admin -c "DROP DATABASE $DB_NAME;" > /dev/null 2>&1
  fi
  
  echo "🗄️  Creating database '$DB_NAME'..."
  as_admin -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
}

# Function to restore from backup
restore_from_backup() {
  local backup_file="$1"
  echo "🔄 Restoring from backup: $(basename "$backup_file")"
  
  # Drop and recreate database using admin connection (no init.sql)
  as_admin -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true
  as_admin -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1 || true
  as_admin -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null 2>&1
  
  # Restore from compressed backup (pg_restore for custom format, or gunzip + psql for plain)
  export PGPASSWORD="$DB_PASSWORD"
  if [[ "$backup_file" == *.gz ]]; then
    # Check if it's a custom format (pg_dump -F c) or plain SQL (pg_dump | gzip)
    if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c "$backup_file" > /dev/null 2>&1; then
      echo "✅ Backup restored successfully (custom format)"
    elif gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
      echo "✅ Backup restored successfully (plain SQL)"
    else
      echo "⚠️  Backup restoration had some conflicts, but data may still be restored"
      echo "💡 This is normal when schema has changed since backup was created"
    fi
  else
    # Fallback for non-compressed backups
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$backup_file" > /dev/null 2>&1; then
    echo "✅ Backup restored successfully"
  else
    echo "⚠️  Backup restoration had some conflicts, but data may still be restored"
    echo "💡 This is normal when schema has changed since backup was created"
    fi
  fi
  
  # Grant necessary permissions for migrations
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
    GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
  " > /dev/null 2>&1 || true
}

start_fresh_from_init() {
  echo "🆕 Starting fresh database from init.sql"
  
  # Generate all seed data from CS folder
  if [[ -f "seed/init.sh" ]]; then
    echo "🌱 Generating all CS seed data..."
    if ./seed/init.sh; then
      echo "✅ All CS seed data generated successfully"
    else
      echo "⚠️  CS seed generation had issues, but continuing..."
    fi
  else
    echo "⚠️  CS seed initialization script not found, using existing SQL"
  fi
  
  if [[ ! -f "$INIT_SQL" ]]; then
    echo "❌ Init file '$INIT_SQL' not found!"
    return 1
  fi
  
  export PGPASSWORD="$DB_PASSWORD"
  echo "🔍 Running: psql $USER_CONN -v ON_ERROR_STOP=1 -f $INIT_SQL"
  if psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$INIT_SQL"; then
    echo "✅ Fresh database created from init.sql"
  else
    echo "❌ Failed to create database from init.sql"
    echo "💡 Check the error output above for details"
    return 1
  fi
}

# Function to run migrations
run_migrations() {
  echo "🚀 Running manual migrations from migrate/ folder..."
  
  export PGPASSWORD="$DB_PASSWORD"
  
  # Check if migration files exist in migrate/ folder
  if ls migrate/*.sql 1> /dev/null 2>&1; then
    echo "📁 Found migration files, applying them..."
      
    # Apply each migration file in order (sorted by filename)
    for migration_file in migrate/*.sql; do
        echo "🔄 Applying migration: $(basename "$migration_file")"
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
          echo "✅ Migration applied: $(basename "$migration_file")"
        else
          echo "⚠️  Migration had issues: $(basename "$migration_file") - this may be normal"
        fi
      done
      
      echo "✅ Manual migration application completed"
    else
    echo "📝 No migration files found in migrate/ folder - database is up to date"
  fi
  
  # Keep audit triggers in sync with any new tables
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 -c "SELECT audit.install_row_triggers();" >/dev/null 2>&1 || true
}

# --- MAIN LOGIC ------------------------------------------------------

# Handle connect mode
if [[ "$CONNECT_DB" == true ]]; then
  echo "🔗 Connecting to existing database..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
  exit 0
fi

# Handle migrate mode
if [[ "$MIGRATE_DB" == true ]]; then
  if [[ "$MIGRATE_ALL" == true ]]; then
    echo "🔄 Migration mode: Applying all migrations from migrate/ folder..."
  else
    echo "🔄 Migration mode: Restoring from backup, then applying most recent migration..."
  fi
  echo ""
  
  export PGPASSWORD="$DB_PASSWORD"
  
  # Check if migration files exist in migrate/ folder
  if ls migrate/*.sql 1> /dev/null 2>&1; then
    if [[ "$MIGRATE_ALL" == true ]]; then
      # For migrate-all, restore from backup first
      LATEST_BACKUP=$(get_latest_backup)
      if [[ -n "$LATEST_BACKUP" ]]; then
        echo "📁 Found latest backup: $(basename "$LATEST_BACKUP")"
        echo "🔄 Restoring from backup before applying migrations..."
        setup_database
        restore_from_backup "$LATEST_BACKUP"
      else
        echo "📝 No backups found, starting fresh..."
        setup_database
        start_fresh_from_init
      fi
      
      # Apply all migration files in order (sorted by filename)
      echo "📁 Found migration files, applying all of them..."
      for migration_file in migrate/*.sql; do
        echo "🔄 Applying migration: $(basename "$migration_file")"
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
          echo "✅ Migration applied: $(basename "$migration_file")"
        else
          echo "⚠️  Migration had issues: $(basename "$migration_file")"
          exit 1
        fi
      done
      echo "✅ All migrations applied successfully"
      # Create backup after all migrations succeed (no migration number prefix for migrate-all)
      create_backup
    else
      # Get the most recent migration file (sorted by modification time, newest first)
      migration_file=$(ls -t migrate/*.sql 2>/dev/null | head -1)
      
      if [[ -n "$migration_file" ]]; then
        migration_num=$(extract_migration_number "$migration_file")
        echo "📁 Found migration file: $(basename "$migration_file")"
        if [[ -n "$migration_num" ]]; then
          echo "   Migration number: $migration_num"
        fi
        
        # Step 1: Restore from previous migration's backup (or latest if no previous found)
        if [[ -n "$migration_num" ]] && [[ "$migration_num" -gt 0 ]]; then
          LATEST_BACKUP=$(get_previous_migration_backup "$migration_num")
        else
          LATEST_BACKUP=$(get_latest_backup)
        fi
        
        if [[ -n "$LATEST_BACKUP" ]]; then
          echo "📁 Found backup: $(basename "$LATEST_BACKUP")"
          echo "🔄 Restoring from backup before applying migration..."
          setup_database
          restore_from_backup "$LATEST_BACKUP"
        else
          echo "📝 No backups found, starting fresh..."
          setup_database
          start_fresh_from_init
        fi
        
        # Step 2: Apply migration
        echo "🔄 Applying migration: $(basename "$migration_file")"
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
          echo "✅ Migration applied successfully: $(basename "$migration_file")"
          
          # Step 3: Create backup with migration number prefix
          create_backup "$migration_num"
        else
          echo "⚠️  Migration had issues: $(basename "$migration_file")"
          exit 1
        fi
      else
        echo "📝 No migration files found in migrate/ folder"
      fi
    fi
  else
    echo "📝 No migration files found in migrate/ folder"
  fi
  
  exit 0
fi

# Handle clean mode
if [[ "$CLEAN_DB" == true ]]; then
  echo "🧹 Clean mode: Starting fresh database..."
  
  # Create backup first (only in clean mode)
  create_backup
  
  # Setup fresh database
  setup_database
  start_fresh_from_init
  
  echo "✅ Clean database setup completed!"
  exit 0
fi

# Default mode: Use latest backup (NO backup creation, NO migrations)
echo "🔄 Default mode: Using latest backup..."

# Get latest backup (don't create a new one)
LATEST_BACKUP=$(get_latest_backup)

if [[ -n "$LATEST_BACKUP" ]]; then
  echo "📁 Found latest backup: $(basename "$LATEST_BACKUP")"
  
  # Setup fresh database
  setup_database
  
  # Restore from backup
  if restore_from_backup "$LATEST_BACKUP"; then
    echo "✅ Database restored and ready"
  else
    echo "⚠️  Backup restoration failed, falling back to init.sql"
    start_fresh_from_init
  fi
else
  echo "📝 No backups found, starting fresh from init.sql"
  setup_database
  start_fresh_from_init
fi

echo "✅ Database setup completed!"
exit 0
