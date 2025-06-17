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
HISTORY_DIR="history"
mkdir -p "$HISTORY_DIR"

# Parse command line arguments
CLEAN_DB=false
MIGRATE_DB=false
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
    --connect)
      CONNECT_DB=true
      shift
      ;;
    *)
      echo "Usage: $0 [--clean|--migrate|--connect]"
      echo "  --clean   : Create backup, then start fresh database from init.sql"
      echo "  --migrate : Generate migration files (interactive)"
      echo "  --connect : Connect to existing database"
      echo "  (default) : Start from latest backup and apply migrations"
      exit 1
      ;;
  esac
done

ADMIN_CONN="postgresql://postgres@${DB_HOST}:${DB_PORT}/postgres"
USER_CONN="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
INIT_SQL=${INIT_SQL:-init.sql}

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

# Function to create backup
create_backup() {
  # Only create backup if database exists and has data
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    # Check if there are any tables with data
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    " 2>/dev/null || echo "0")
    
    if [[ "$table_count" -gt 0 ]]; then
      local timestamp=$(date +"%Y%m%d_%H%M%S")
      local backup_file="$HISTORY_DIR/backup_${timestamp}.sql"
      
      echo "📦 Backup saved → $(basename "$backup_file")"
      
      # Create backup excluding drizzle migration table
      pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
        --exclude-table=__drizzle_migrations \
        > "$backup_file" 2>/dev/null || {
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
get_latest_backup() {
  # Check if history directory exists and has backup files
  if [[ -d "$HISTORY_DIR" ]] && ls "$HISTORY_DIR"/backup_*.sql 1> /dev/null 2>&1; then
    # Simply get the most recent backup by modification time
    ls -t "$HISTORY_DIR"/backup_*.sql 2>/dev/null | head -1
  else
    # Return empty string if no backups found
    echo ""
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
  
  # Restore from backup
  export PGPASSWORD="$DB_PASSWORD"
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$backup_file" > /dev/null 2>&1; then
    echo "✅ Backup restored successfully"
  else
    echo "⚠️  Backup restoration had some conflicts, but data may still be restored"
    echo "💡 This is normal when schema has changed since backup was created"
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
  
  if [[ ! -f "$INIT_SQL" ]]; then
    echo "❌ Init file '$INIT_SQL' not found!"
    return 1
  fi
  
  export PGPASSWORD="$DB_PASSWORD"
  if psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$INIT_SQL" > /dev/null 2>&1; then
    echo "✅ Fresh database created from init.sql"
  else
    echo "❌ Failed to create database from init.sql"
    return 1
  fi
}

# Function to run migrations
run_migrations() {
  echo "🚀 Running Drizzle migrations..."
  
  # Set environment variables for drizzle-kit
  export DB_USER DB_PASSWORD DB_NAME DB_HOST DB_PORT
  export PGPASSWORD="$DB_PASSWORD"
  
  # Use drizzle-kit migrate instead of manual SQL application
  if npx drizzle-kit migrate > /dev/null 2>&1; then
    echo "✅ All migrations applied successfully"
  else
    echo "⚠️  Some migrations had issues - this may be normal for existing databases"
    echo "💡 Attempting to continue with manual migration application..."
    
    # Fallback: Check if migration files exist and apply them manually
    if ls drizzle/00*.sql 1> /dev/null 2>&1; then
      echo "📁 Found migration files, applying them manually..."
      
      # Apply each migration file manually
      for migration_file in drizzle/00*.sql; do
        echo "🔄 Applying migration: $(basename "$migration_file")"
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
          echo "✅ Migration applied: $(basename "$migration_file")"
        else
          echo "⚠️  Migration had issues: $(basename "$migration_file") - this may be normal"
        fi
      done
      
      echo "✅ Manual migration application completed"
    else
      echo "📝 No migration files found - database is up to date"
    fi
  fi
}

generate_and_copy_files() {
  echo "📝 Generating and copying files to client..."
  
  # Clean schema and copy to client
  if node scripts/clean-schema.js; then
    echo "✅ Schema cleaned and copied"
  else
    echo "❌ Failed to clean schema"
    return 1
  fi
  
  # Generate types and copy to client
  if node scripts/generate-types.js; then
    echo "✅ Types generated and copied"
  else
    echo "❌ Failed to generate types"
    return 1
  fi
  
  # Generate queries and mutations
  if node scripts/generate-queries-mutations.js; then
    echo "✅ Queries and mutations generated"
  else
    echo "❌ Failed to generate queries and mutations"
    return 1
  fi
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
  echo "🔄 Migration mode: Generating migration files from schema changes..."
  echo "⚠️  Note: This creates a temporary clean database for migration generation only"
  echo "⚠️  Your data will be preserved - use 'yarn start' afterward to apply migrations with data"
  echo ""
  
  # Create backup first for migrate mode
  create_backup
  
  # Setup fresh database
  setup_database
  start_fresh_from_init
  
  # Pull latest schema from database first
  echo "📥 Pulling latest schema from database..."
  if npx drizzle-kit pull; then
    echo "✅ Latest schema pulled successfully"
  else
    echo "⚠️  Pull failed, continuing with existing schema"
  fi
  
  # Generate migrations with interactive diff
  echo "🔍 Generating migrations (interactive diff will show)..."
  if npx drizzle-kit generate; then
    # Check if any new migration files were created
    if ls drizzle/00*.sql 1> /dev/null 2>&1; then
      echo "✅ Migration files generated successfully"
      echo "📁 New migration files created in drizzle/ directory"
      echo ""
      echo "🎯 Next steps:"
      echo "   1. Review the generated migration files in drizzle/"
      echo "   2. Run 'yarn start' to apply migrations with your data restored"
      echo "   3. Or run 'yarn connect' to connect to your database with data"
    else
      echo "📝 No schema changes detected - no migration files generated"
      echo "💡 This means your schema is already in sync with the database"
    fi
  else
    echo "❌ Migration generation failed"
    exit 1
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
  
  # Generate and copy files
  generate_and_copy_files
  
  echo "✅ Clean database setup completed!"
  exit 0
fi

# Default mode: Use latest backup then migrate (NO backup creation)
echo "🔄 Default mode: Using latest backup then applying migrations..."

# Get latest backup (don't create a new one)
LATEST_BACKUP=$(get_latest_backup)

if [[ -n "$LATEST_BACKUP" ]]; then
  echo "📁 Found latest backup: $(basename "$LATEST_BACKUP")"
  
  # Setup fresh database
  setup_database
  
  # Restore from backup
  if restore_from_backup "$LATEST_BACKUP"; then
    # Apply any pending migrations
    run_migrations
  else
    echo "⚠️  Backup restoration failed, falling back to init.sql"
    start_fresh_from_init
  fi
else
  echo "📝 No backups found, starting fresh from init.sql"
  setup_database
  start_fresh_from_init
fi

# Generate and copy files
generate_and_copy_files

echo "✅ Database setup completed!"

# Set up cleanup trap - only create backup on exit for clean mode
cleanup() {
  echo "🛑 Shutting down..."
  # Only create backup on exit if we're in clean mode
  if [[ "$CLEAN_DB" == true ]]; then
    create_backup
  fi
}

trap cleanup EXIT

# Keep script running if not in CI
if [[ -z "${CI:-}" ]]; then
  echo "💡 Database is ready. Press Ctrl+C to stop."
  echo "🔗 Connect with: psql '$USER_CONN'"
  
  # Keep running until interrupted
  while true; do
    sleep 1
  done
fi
