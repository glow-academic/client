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
for arg in "$@"; do
  case $arg in --clean) CLEAN_DB=true; shift ;; esac
done

ADMIN_CONN="postgresql://postgres@${DB_HOST}:${DB_PORT}/postgres"
USER_CONN="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
INIT_SQL=${INIT_SQL:-init.sql}

# --- OPTIONAL: install PostgreSQL if missing -------------------------
if ! command -v psql &>/dev/null; then
  echo "PostgreSQL client not found - installing…"
  case "$(uname)" in
    Darwin)  
      brew install postgresql@15
      # Create postgres superuser if it doesn't exist
      if ! psql -U postgres -c '\q' 2>/dev/null; then
        echo "Creating postgres superuser for Homebrew installation..."
        createuser -s postgres
      fi
      ;;
    Linux)
      if   command -v apt-get &>/dev/null; then sudo apt-get update && sudo apt-get -y install postgresql
      elif command -v yum     &>/dev/null; then sudo yum       -y install postgresql-server postgresql-contrib
      else echo "Unsupported distro. Install PostgreSQL manually." && exit 1; fi ;;
    *) echo "Unsupported OS." && exit 1 ;;
  esac
fi

# Ensure server is running -----------------------------------------------------
pg_isready -q || {
  echo "Starting PostgreSQL service…"
  if [[ "$(uname)" == Darwin ]]; then 
    brew services start postgresql@15
    # Create postgres superuser if it doesn't exist (after service start)
    if ! psql -U postgres -c '\q' 2>/dev/null; then
      echo "Creating postgres superuser for Homebrew installation..."
      createuser -s postgres
    fi
  else 
    sudo systemctl start postgresql || sudo service postgresql start
  fi
  sleep 5
}

# --- HELPERS -----------------------------------------------------------------
as_admin()    { psql "$ADMIN_CONN" -qtA "$@"; }
role_exists() { as_admin -c "SELECT 1 FROM pg_roles    WHERE rolname='$DB_USER';" | grep -q 1; }
db_exists()   { as_admin -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -q 1; }
__backup() {   # <‑­‑‑ NEW
  ts=$(date +%Y%m%d_%H%M%S)
  pg_dump "$USER_CONN" > "$__DATA_DIR/backup_${ts}.sql"
  echo "Backup saved → $__DATA_DIR/backup_${ts}.sql"
}

# --- ROLE --------------------------------------------------------------------
if ! role_exists; then
  echo "Creating role $DB_USER with CREATEDB privilege…"
  as_admin -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD' CREATEDB;"
fi

# --- DATABASE (clean / create / restore) -------------------------------------
if $CLEAN_DB && db_exists; then
  echo "Clean requested - backing up then dropping $DB_NAME..."
  __backup                      # <‑­‑‑ NEW
  
  # Terminate all connections to the database before dropping it
  as_admin -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();"
  
  as_admin -c "DROP DATABASE $DB_NAME;"
fi

if ! db_exists; then
  echo "Creating database $DB_NAME owned by $DB_USER..."
  as_admin -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

# If DB is empty, try to restore the newest dump ------------------------------
TABLES=$(psql "$USER_CONN" -qtA -c \
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

if [[ $TABLES -eq 0 ]]; then
  LATEST=$(ls -t $__DATA_DIR/backup_*.sql 2>/dev/null | head -n1)
  if [[ -n $LATEST && $CLEAN_DB = false ]]; then          # <‑­‑‑ NEW
    echo "Restoring $LATEST …"
    psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$LATEST"
  elif [[ -f $INIT_SQL ]]; then
    echo "Applying $INIT_SQL …"
    psql "$USER_CONN" -v ON_ERROR_STOP=1 -f "$INIT_SQL"
  else
    echo "No schema or backup to apply (DB is empty)."
  fi
fi

# --- READY: open psql, then dump a fresh backup ------------------------------
echo "Database ready - opening psql (type '\q' to quit)."
psql "$USER_CONN"

echo "Session ended - writing fresh backup…"
__backup                                         # <‑­‑‑ NEW
