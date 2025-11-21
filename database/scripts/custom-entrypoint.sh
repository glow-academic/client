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
HISTORY_DIR=${HISTORY_DIR:-/database/history}
CLEAN_DB=${CLEAN_DB:-false}

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
  backup_file="$HISTORY_DIR/restore_${ts}.sql.gz"
  
  # Wait a moment for any ongoing transactions to complete
  sleep 2
  
  # Create compressed backup (custom format)
  log_info "Creating database backup: $backup_file"
  if pg_dump "postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}" -F c -f "$backup_file" 2>/dev/null; then
    log_success "📦 Backup saved → $backup_file"
    
    # Keep only the last 10 backups to prevent disk space issues
    cd "$HISTORY_DIR"
    ls -t restore_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -- 2>/dev/null || true
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
log_info "CLEAN_DB: $CLEAN_DB"

# If CLEAN_DB is true, remove the data directory to force reinitialization
if [ "$CLEAN_DB" = "true" ]; then
  log_warning "🧹 CLEAN_DB is set to true. Cleaning database..."
  rm -rf /var/lib/postgresql/data/*
  log_success "Database data directory cleaned."
fi

# --- SETUP BASIC INITIALIZATION --------------------------------------
log_info "Setting up database initialization..."

# Create the initialization directory
mkdir -p /docker-entrypoint-initdb.d

# --- GENERATE ALL CS SEED DATA --------------------------------------
log_info "🌱 Generating all CS seed data..."
if [ -f "/docker-entrypoint-initdb.d/seed/init.sh" ]; then
  cd /docker-entrypoint-initdb.d/seed
  if ./init.sh; then
    log_success "✅ All CS seed data generated successfully"
  else
    log_warning "⚠️  CS seed generation had issues, but continuing..."
  fi
  cd - > /dev/null
else
  log_warning "⚠️  CS seed initialization script not found, using existing SQL"
fi

# Create the main initialization script with extensions
cat > /docker-entrypoint-initdb.d/00-glow-init.sql << 'EOF'
-- Glow Database Initialization Script
-- This script sets up the database with proper extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log the start of initialization
DO $$
BEGIN
    RAISE NOTICE '🚀 Starting Glow database initialization...';
END $$;
EOF

# Create a SQL script to restore from backup if available (only if not cleaning)
if [ "$CLEAN_DB" != "true" ]; then
  # Look for restore_*.sql.gz files in history volume
  if ls "$HISTORY_DIR"/restore_*.sql.gz 1> /dev/null 2>&1; then
    latest_backup=$(ls -t "$HISTORY_DIR"/restore_*.sql.gz 2>/dev/null | head -1)
  if [[ -n "$latest_backup" && -f "$latest_backup" ]]; then
    log_info "📁 Found latest backup: $(basename "$latest_backup")"
    log_info "🔄 Setting up backup restoration..."
    
      # Decompress the backup file and copy to initdb.d
      # Handle both custom format (pg_restore) and plain SQL (gunzip)
      if gunzip -c "$latest_backup" > /docker-entrypoint-initdb.d/50-restore-backup.sql 2>/dev/null; then
        log_success "Backup decompressed and prepared for restoration"
      else
        log_error "Failed to decompress backup file: $latest_backup"
        exit 1
  fi
else
      log_error "❌ No backup file found in $HISTORY_DIR"
      log_error "Backup is required when CLEAN_DB=false. Please ensure restore_*.sql.gz files exist in the history volume."
      exit 1
    fi
  else
    log_error "❌ No restore_*.sql.gz files found in $HISTORY_DIR"
    log_error "Backup is required when CLEAN_DB=false. Please ensure restore_*.sql.gz files exist in the history volume."
    exit 1
  fi
elif [ "$CLEAN_DB" = "true" ]; then
    log_info "🧹 CLEAN_DB enabled - starting with fresh database (skipping backup restoration)"
  
  # Copy the main initialization script for fresh database
  log_info "📋 Setting up main database schema..."
  if [ -f "/docker-entrypoint-initdb.d/app/init.sql" ]; then
    # Transform all relative paths to absolute paths for Docker context
    # This handles both top-level includes and nested includes within subdirectories
    log_info "🔄 Generating Docker-specific init.sql with absolute paths..."
    
    # First transform top-level app/init.sql
    sed -e 's|\\i app/|\\i /docker-entrypoint-initdb.d/app/|g' \
        -e 's|\\i seed/|\\i /docker-entrypoint-initdb.d/seed/|g' \
      /docker-entrypoint-initdb.d/app/init.sql > /docker-entrypoint-initdb.d/10-main-init.sql
    
    # Then transform all nested SQL files that contain \i directives
    find /docker-entrypoint-initdb.d/app -name "*.sql" -type f | while read -r sqlfile; do
      # Skip if already processed
      if [ "$sqlfile" = "/docker-entrypoint-initdb.d/app/init.sql" ]; then
        continue
      fi
      
      # Transform paths in-place for nested files
      sed -i.bak \
        -e 's|\\i app/|\\i /docker-entrypoint-initdb.d/app/|g' \
        -e 's|\\i seed/|\\i /docker-entrypoint-initdb.d/seed/|g' \
        "$sqlfile"
      rm -f "${sqlfile}.bak"
    done
    
    log_success "✅ Docker-specific initialization script prepared"
  else
    log_warning "⚠️  Main init.sql not found"
  fi
fi

# --- FINALIZATION SCRIPT ---------------------------------------------
cat > /docker-entrypoint-initdb.d/99-finalize.sql << 'EOF'
-- Finalization Script
DO $$
BEGIN
    RAISE NOTICE '✅ Glow database initialization completed successfully!';
    RAISE NOTICE '🔗 Database is ready for connections';
    RAISE NOTICE '💡 Use "yarn migrate" to generate migrations, then restart to apply them';
END $$;
EOF

log_success "Database initialization scripts prepared"

# --- START POSTGRESQL ------------------------------------------------
log_info "🚀 Starting PostgreSQL server..."

# Start PostgreSQL in the background so we can handle signals
docker-entrypoint.sh "$@" &
PG_PID=$!

log_success "PostgreSQL started with PID: $PG_PID"
log_success "🎉 Database is ready! Use 'yarn migrate' for schema changes."

# Wait for PostgreSQL process
wait "$PG_PID"