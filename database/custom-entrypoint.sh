#!/bin/bash
set -euo pipefail

# Colors for Docker logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- CONFIG ----------------------------------------------------------
DB_USER=${POSTGRES_USER:-myuser}
DB_PASSWORD=${POSTGRES_PASSWORD:-mypassword}
DB_NAME=${POSTGRES_DB:-mydb}
INIT_SQL=${INIT_SQL:-init.sql}
INIT_DIR=${INIT_DIR:-init}
HISTORY_DIR=${HISTORY_DIR:-/database/history}
MIGRATIONS_DIR=${MIGRATIONS_DIR:-/database/migrations}

# --- LOGGING FUNCTIONS -----------------------------------------------
log_info() {
  echo -e "${CYAN}[DOCKER-DB]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[DOCKER-DB]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[DOCKER-DB]${NC} $1"
}

log_error() {
  echo -e "${RED}[DOCKER-DB]${NC} $1"
}

# --- BACKUP FUNCTION -------------------------------------------------
backup_database() {
  log_info "Starting database backup on shutdown..."
  
  # Create history directory if it doesn't exist
  mkdir -p "$HISTORY_DIR"
  
  # Generate timestamp
  ts=$(date +%Y%m%d_%H%M%S)
  backup_file="$HISTORY_DIR/backup_${ts}.sql"
  
  # Wait a moment for any ongoing transactions to complete
  sleep 2
  
  # Create the backup
  log_info "Creating database backup: $backup_file"
  if pg_dump "postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}" > "$backup_file" 2>/dev/null; then
    log_success "📦 Backup saved → $backup_file"
    
    # Keep only the last 10 backups to prevent disk space issues
    cd "$HISTORY_DIR"
    ls -t backup_*.sql 2>/dev/null | tail -n +11 | xargs -r rm -- 2>/dev/null || true
    log_info "Cleaned up old backups (keeping last 10)"
  else
    log_warning "⚠️  Backup failed or database not ready"
  fi
  
  log_success "Database backup completed"
}

# --- SIGNAL HANDLERS -------------------------------------------------
cleanup() {
  log_info "Received shutdown signal..."
  backup_database
  log_info "Shutting down PostgreSQL..."
  # Send SIGTERM to postgres process
  if [ -n "${PG_PID:-}" ]; then
    kill -TERM "$PG_PID" 2>/dev/null || true
    wait "$PG_PID" 2>/dev/null || true
  fi
  exit 0
}

# Trap signals that indicate shutdown
trap cleanup SIGTERM SIGINT SIGQUIT

# --- MAIN EXECUTION --------------------------------------------------
log_info "🐳 Starting Glow Database (Docker)"
log_info "DB_USER: $DB_USER"
log_info "DB_NAME: $DB_NAME"
log_info "CLEAN_DB: ${CLEAN_DB:-false}"

# If CLEAN_DB is true, remove the data directory to force reinitialization
if [ "$CLEAN_DB" = "true" ]; then
  log_warning "🧹 CLEAN_DB is set to true. Cleaning database..."
  rm -rf /var/lib/postgresql/data/*
  log_success "Database data directory cleaned."
fi

# --- SETUP INITIALIZATION SCRIPTS ------------------------------------
log_info "Setting up database initialization..."

# Create the initialization directory
mkdir -p /docker-entrypoint-initdb.d

# Create the main initialization script
cat > /docker-entrypoint-initdb.d/00-glow-init.sql << 'EOF'
-- Glow Database Initialization Script
-- This script sets up the database with proper extensions and logging

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log the start of initialization
DO $$
BEGIN
    RAISE NOTICE '🚀 Starting Glow database initialization...';
END $$;
EOF

# --- HANDLE MIGRATIONS -----------------------------------------------
if [ -d "$MIGRATIONS_DIR" ] && [ -n "$(ls -A $MIGRATIONS_DIR/*.sql 2>/dev/null)" ]; then
  log_info "📋 Found migration files, setting up migration application..."
  
  # Create migration application script
  cat > /docker-entrypoint-initdb.d/01-apply-migrations.sql << EOF
-- Apply Drizzle Migrations
DO \$\$
BEGIN
    RAISE NOTICE '📋 Applying Drizzle migrations...';
END \$\$;
EOF

  # Add each migration file to the initialization
  migration_counter=2
  for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
      migration_name=$(basename "$migration_file")
      log_info "  📄 Adding migration: $migration_name"
      
      # Copy migration to init directory with proper ordering
      cp "$migration_file" "/docker-entrypoint-initdb.d/$(printf "%02d" $migration_counter)-$migration_name"
      chmod 755 "/docker-entrypoint-initdb.d/$(printf "%02d" $migration_counter)-$migration_name"
      
      migration_counter=$((migration_counter + 1))
    fi
  done
  
  log_success "Migration files prepared for application"
else
  log_info "📝 No migration files found in $MIGRATIONS_DIR"
fi

# --- HANDLE LEGACY INIT SYSTEM (FALLBACK) ---------------------------
# Only use legacy init if no migrations are present
if [ ! -d "$MIGRATIONS_DIR" ] || [ -z "$(ls -A $MIGRATIONS_DIR/*.sql 2>/dev/null)" ]; then
  log_info "🔄 No migrations found, checking for legacy initialization..."
  
  if [ -f "/$INIT_SQL" ]; then
    log_info "📄 Found legacy init.sql, setting up modular initialization..."
    
    # Create wrapper for legacy init
    cat > /docker-entrypoint-initdb.d/50-legacy-init.sql << EOF
-- Legacy Database Initialization
DO \$\$
BEGIN
    RAISE NOTICE '🔄 Applying legacy database schema...';
END \$\$;

-- Execute the legacy init.sql file
\i /$INIT_SQL
EOF
    
    # Copy the init directory if it exists
    if [ -d "/$INIT_DIR" ]; then
      log_info "📁 Copying modular SQL files from /$INIT_DIR..."
      cp -r "/$INIT_DIR" "/docker-entrypoint-initdb.d/"
      chmod -R 755 "/docker-entrypoint-initdb.d/$INIT_DIR"
      log_success "Copied modular SQL files"
    fi
  else
    log_warning "No initialization files found (neither migrations nor legacy init.sql)"
  fi
fi

# --- RUN DATABASE TESTS (if in test mode) ---------------------------
if [ "${TESTING:-false}" = "true" ]; then
  log_info "🧪 Test mode detected - will run database tests after startup"
  
  # Create test script that will run after database is ready
  cat > /docker-entrypoint-initdb.d/98-run-tests.sql << 'EOF'
-- Database Test Script
DO $$
BEGIN
    RAISE NOTICE '🧪 Running database tests...';
    
    -- Test basic functionality
    RAISE NOTICE 'Testing basic database operations...';
    
    -- Test extensions
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'pgcrypto extension not found';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        RAISE EXCEPTION 'uuid-ossp extension not found';
    END IF;
    
    -- Test UUID generation
    PERFORM gen_random_uuid();
    PERFORM uuid_generate_v4();
    
    RAISE NOTICE '✅ Database tests passed!';
END $$;
EOF
fi

# --- FINALIZATION SCRIPT ---------------------------------------------
cat > /docker-entrypoint-initdb.d/99-finalize.sql << 'EOF'
-- Finalization Script
DO $$
BEGIN
    RAISE NOTICE '✅ Glow database initialization completed successfully!';
    RAISE NOTICE '🔗 Database is ready for connections';
END $$;
EOF

log_success "Database initialization scripts prepared"

# --- START POSTGRESQL ------------------------------------------------
log_info "🚀 Starting PostgreSQL server..."

# Start PostgreSQL in the background so we can handle signals
docker-entrypoint.sh postgres "$@" &
PG_PID=$!

log_success "PostgreSQL started with PID: $PG_PID"
log_success "🎉 Database is ready! Backup will be created automatically on shutdown."

# Wait for PostgreSQL process
wait "$PG_PID"