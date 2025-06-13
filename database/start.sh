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
__DATA_DIR=history
mkdir -p "$__DATA_DIR"

# Process command‐line arguments
CLEAN_DB=false
CONNECT_DB=false
for arg in "$@"; do
  case $arg in 
    --clean) CLEAN_DB=true; shift ;;
    --connect) CONNECT_DB=true; shift ;;
  esac
done

ADMIN_CONN="postgresql://postgres@${DB_HOST}:${DB_PORT}/postgres"
USER_CONN="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
INIT_SQL=${INIT_SQL:-init.sql}
INIT_DIR=${INIT_DIR:-init}

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
__backup() {
  ts=$(date +%Y%m%d_%H%M%S)
  pg_dump "$USER_CONN" > "$__DATA_DIR/backup_${ts}.sql"
  echo "📦 Backup saved → $__DATA_DIR/backup_${ts}.sql"
}

# --- ROLE ------------------------------------------------------------
if ! role_exists; then
  echo "👤 Creating role $DB_USER with CREATEDB privilege…"
  as_admin -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD' CREATEDB;"
fi

# --- DATABASE (clean / create / restore) ----------------------------
if $CLEAN_DB && db_exists; then
  echo "🧹 Clean requested - backing up then dropping $DB_NAME..."
  __backup
  
  # Terminate all connections to the database before dropping it
  as_admin -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();"
  
  as_admin -c "DROP DATABASE $DB_NAME;"
fi

if ! db_exists; then
  echo "🗄️  Creating database $DB_NAME owned by $DB_USER..."
  as_admin -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

# --- APPLY MIGRATIONS ------------------------------------------------
echo "🔄 Checking for migrations to apply..."
if [[ -d "migrations" ]] && [[ -n "$(ls -A migrations/*.sql 2>/dev/null)" ]]; then
  echo "📋 Found migration files, applying them..."
  for migration_file in migrations/*.sql; do
    if [[ -f "$migration_file" ]]; then
      echo "  ⚡ Applying $(basename "$migration_file")..."
      if psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$migration_file" > /dev/null 2>&1; then
        echo "  ✅ Applied $(basename "$migration_file")"
      else
        echo "  ⚠️  Warning: Could not apply $(basename "$migration_file") (may already be applied)"
      fi
    fi
  done
else
  echo "📝 No migration files found in migrations/ directory"
fi

# If DB is empty, try to restore or initialize ----------------------
TABLES=$(psql "$USER_CONN" -qtA -c \
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

if [[ $TABLES -eq 0 ]]; then
  LATEST=$(ls -t $__DATA_DIR/backup_*.sql 2>/dev/null | head -n1)
  if [[ -n $LATEST && $CLEAN_DB = false ]]; then
    echo "🔄 Restoring $LATEST …"
    psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$LATEST"
  elif [[ -f $INIT_SQL ]]; then
    echo "🚀 Applying database schema using modular approach…"
    
    # Check if we have the modular structure
    if [[ -d $INIT_DIR ]]; then
      echo "📁 Found modular SQL files in $INIT_DIR directory"
      echo "⚡ Executing master init.sql which will load all modules in correct order…"
      
      # Set the search path for \i commands to work properly
      export PGPASSWORD="$DB_PASSWORD"
      
      # Execute the master init.sql file which orchestrates the modular loading
      psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$INIT_SQL"
    else
      echo "📄 No modular structure found, applying single $INIT_SQL file…"
      psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$INIT_SQL"
    fi
  else
    echo "📝 No schema or backup to apply (DB is empty)."
    echo "Expected files: $INIT_SQL or backup files in $__DATA_DIR/"
  fi
fi

echo "✅ Database $DB_NAME is ready!"
echo "🔗 Connection: $USER_CONN"

# Handle different modes
if $CONNECT_DB; then
  echo ""
  echo "🔌 Opening interactive database connection..."
  echo "💡 You can now run SQL queries directly. Type \\q to exit."
  echo "📊 Useful commands:"
  echo "   \\dt                    - List all tables"
  echo "   \\d table_name         - Describe table structure"
  echo "   SELECT * FROM users;   - Query users table"
  echo "   \\q                     - Quit"
  echo ""
  
  # Start interactive psql session
  psql "$USER_CONN"
elif [[ -f /.dockerenv ]]; then
  echo "🐳 Docker environment detected. Keeping PostgreSQL running..."
  # This will keep the container running
  tail -f /dev/null
else
  echo "💡 Database is ready for connections. Use 'psql \"$USER_CONN\"' to connect."
  echo "💡 Or use 'yarn start --connect' for an interactive session."
fi
