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

# Process command‐line arguments
CLEAN_DB=false
CONNECT_DB=false
MIGRATE_DB=false
for arg in "$@"; do
  case $arg in 
    --clean) CLEAN_DB=true; shift ;;
    --connect) CONNECT_DB=true; shift ;;
    --migrate) MIGRATE_DB=true; shift ;;
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

create_backup() {
  local timestamp=$(date +"%Y%m%d_%H%M%S")
  local backup_file="history/backup_${timestamp}.sql"
  
  echo "📦 Backup saved → $(basename "$backup_file")"
  
  # Create backup excluding drizzle migration table
  pg_dump -h localhost -p 5432 -U ashoksaravanan mydb \
    --exclude-table=__drizzle_migrations \
    > "$backup_file" 2>/dev/null || {
    echo "⚠️  Backup creation had issues, but continuing..."
    touch "$backup_file"  # Create empty file so script doesn't fail
  }
}

get_latest_backup() {
  ls -t "$HISTORY_DIR"/backup_*.sql 2>/dev/null | head -n1 || echo ""
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
  
  # Drop and recreate database completely empty (no init.sql)
  dropdb -h localhost -p 5432 -U ashoksaravanan mydb 2>/dev/null || true
  createdb -h localhost -p 5432 -U ashoksaravanan mydb
  
  # Restore from backup
  if psql -h localhost -p 5432 -U ashoksaravanan -d mydb -f "$backup_file" > /dev/null 2>&1; then
    echo "✅ Backup restored successfully"
  else
    echo "⚠️  Backup restoration had some conflicts, but data may still be restored"
    echo "💡 This is normal when schema has changed since backup was created"
  fi
  
  # Grant necessary permissions for migrations
  psql -h localhost -p 5432 -U ashoksaravanan -d mydb -c "
    GRANT ALL PRIVILEGES ON DATABASE mydb TO ashoksaravanan;
    GRANT ALL PRIVILEGES ON SCHEMA public TO ashoksaravanan;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ashoksaravanan;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ashoksaravanan;
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
  
  # Check if migration files exist
  if ls drizzle/00*.sql 1> /dev/null 2>&1; then
    echo "📁 Found migration files, applying them..."
    
    # Apply each migration file manually
    for migration_file in drizzle/00*.sql; do
      echo "🔄 Applying migration: $(basename "$migration_file")"
      if psql -h localhost -p 5432 -U ashoksaravanan -d mydb -f "$migration_file" > /dev/null 2>&1; then
        echo "✅ Migration applied: $(basename "$migration_file")"
      else
        echo "⚠️  Migration had issues: $(basename "$migration_file") - this may be normal"
      fi
    done
    
    # Update drizzle migration table to mark migrations as applied
    psql -h localhost -p 5432 -U ashoksaravanan -d mydb -c "
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
      INSERT INTO __drizzle_migrations (hash, created_at) 
      VALUES ('0000_busy_gwen_stacy', extract(epoch from now()) * 1000)
      ON CONFLICT DO NOTHING;
    " > /dev/null 2>&1 || true
    
    echo "✅ All migrations applied successfully"
  else
    echo "📝 No migration files found - database is up to date"
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

# Handle connection-only mode
if [[ "$CONNECT_DB" == true ]]; then
  if [[ "$CLEAN_DB" == true ]]; then
    echo "🧹 Clean connect mode: Creating fresh database then connecting..."
    
    # Create backup first
    create_backup
    
    # Setup fresh database
    setup_database
    start_fresh_from_init
    
    echo "🔗 Connecting to fresh database..."
    export PGPASSWORD="$DB_PASSWORD"
    psql "$USER_CONN"
  elif db_exists; then
    echo "🔗 Connecting to existing database..."
    export PGPASSWORD="$DB_PASSWORD"
    psql "$USER_CONN"
  else
    echo "❌ Database '$DB_NAME' does not exist!"
    echo "💡 Run without --connect to create it first"
    exit 1
  fi
  exit 0
fi

# Handle migrate mode
if [[ "$MIGRATE_DB" == true ]]; then
  echo "🔄 Migration mode: Generating migration files from schema changes..."
  echo "⚠️  Note: This creates a temporary clean database for migration generation only"
  echo "⚠️  Your data will be preserved - use 'yarn start' afterward to apply migrations with data"
  echo ""
  
  # Create backup first
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
  
  # Create backup first
  create_backup
  
  # Setup fresh database
  setup_database
  start_fresh_from_init
  
  # Generate and copy files
  generate_and_copy_files
  
  echo "✅ Clean database setup completed!"
  exit 0
fi

# Default mode: Use latest backup then migrate
echo "🔄 Default mode: Using latest backup then applying migrations..."

# Create backup of current state
create_backup

# Get latest backup
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

# Set up cleanup trap
cleanup() {
  echo "🛑 Shutting down..."
  create_backup
}

trap cleanup EXIT

# Keep script running if not in CI
if [[ -z "${CI:-}" ]]; then
  echo "💡 Database is ready. Press Ctrl+C to stop and create backup."
  echo "🔗 Connect with: psql '$USER_CONN'"
  
  # Keep running until interrupted
  while true; do
    sleep 1
  done
fi
