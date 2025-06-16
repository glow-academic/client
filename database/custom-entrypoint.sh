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
if [ "$CLEAN_DB" != "true" ] && ls "$HISTORY_DIR"/backup_*.sql 1> /dev/null 2>&1; then
  latest_backup=$(ls -t "$HISTORY_DIR"/backup_*.sql 2>/dev/null | head -1)
  if [[ -n "$latest_backup" && -f "$latest_backup" ]]; then
    log_info "📁 Found latest backup: $(basename "$latest_backup")"
    log_info "🔄 Setting up backup restoration..."
    
    # Copy the backup file to be restored during initialization
    cp "$latest_backup" /docker-entrypoint-initdb.d/50-restore-backup.sql
    log_success "Backup prepared for restoration"
  fi
else
  if [ "$CLEAN_DB" = "true" ]; then
    log_info "🧹 CLEAN_DB enabled - starting with fresh database (skipping backup restoration)"
  else
    log_info "📝 No backup files found - starting with fresh database"
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