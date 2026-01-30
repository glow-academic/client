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
DB_OPERATION=${DB_OPERATION:-}

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
log_info "DB_OPERATION: ${DB_OPERATION:-<unset>}"

# Handle DB_OPERATION modes
# Empty string or unset means skip initialization, continue with existing database
if [ "$DB_OPERATION" = "" ]; then
  log_info "⏭️  DB_OPERATION is empty/unset - Skipping initialization, using existing database"
  # Skip all initialization setup and go straight to starting PostgreSQL
  # We'll handle this after the initialization directory setup
fi

# --- SETUP BASIC INITIALIZATION --------------------------------------
# Skip initialization setup if DB_OPERATION is empty (use existing database)
if [ "$DB_OPERATION" != "" ]; then
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
fi

# Handle DB_OPERATION modes for initialization
if [ "$DB_OPERATION" = "" ]; then
  log_info "⏭️  DB_OPERATION is empty/unset - Skipping all initialization scripts"
  # Don't create any initialization scripts, just use existing database
elif [[ "$DB_OPERATION" =~ ^seed_.*\.sql$ ]]; then
  # DB_OPERATION is a seed filename (e.g., seed_20250115_143022.sql)
  SEED_FILE="/database/seeds/$DB_OPERATION"
  log_info "🌱 DB_OPERATION=$DB_OPERATION - Loading seed file..."
  
  # Validate seed file exists
  if [ ! -f "$SEED_FILE" ]; then
    log_error "❌ Seed file not found: $SEED_FILE"
    log_error "Available seed files in /database/seeds/:"
    ls -la /database/seeds/ 2>/dev/null || log_error "  (seeds directory is empty or doesn't exist)"
    exit 1
  fi
  
  log_warning "🧹 Cleaning database before loading seed file..."
  rm -rf /var/lib/postgresql/data/18/*
  log_success "Database data directory cleaned."
  
  # Copy seed file to initialization directory
  log_info "📋 Copying seed file to initialization directory..."
  cp "$SEED_FILE" /docker-entrypoint-initdb.d/20-load-seed.sql
  chmod 644 /docker-entrypoint-initdb.d/20-load-seed.sql
  chown postgres:postgres /docker-entrypoint-initdb.d/20-load-seed.sql
  
  log_success "✅ Seed file prepared for initialization: $DB_OPERATION"
elif [ "$DB_OPERATION" = "RESTORE" ]; then
  # DB_OPERATION=RESTORE (explicitly set)
  log_info "🔄 DB_OPERATION=RESTORE - Looking for backup files..."
  
  # Look for restore_*.sql.gz files in history volume
  # Handles both old format (restore_TIMESTAMP.sql.gz) and new format (restore_MIGRATIONNUM_TIMESTAMP.sql.gz)
  if ls "$HISTORY_DIR"/restore_*.sql.gz 1> /dev/null 2>&1; then
    # Get the most recent backup by modification time (works for both formats)
    latest_backup=$(ls -t "$HISTORY_DIR"/restore_*.sql.gz 2>/dev/null | head -1)
    if [[ -n "$latest_backup" && -f "$latest_backup" ]]; then
      log_info "📁 Found latest backup: $(basename "$latest_backup")"
      log_info "🔄 Setting up backup restoration..."
      
      # Handle both custom format (pg_dump -F c) and plain SQL (gzipped)
      # Try custom format first (pg_restore), then fall back to plain SQL (gunzip)
      if pg_restore -l "$latest_backup" > /dev/null 2>&1; then
        # Custom format backup - create a restore script that uses pg_restore
        log_info "Detected custom format backup, creating restore script..."
        backup_basename=$(basename "$latest_backup")
        cat > /docker-entrypoint-initdb.d/50-restore-backup.sh << EOF
#!/bin/bash
set -e
log_info() { echo -e "\${CYAN}[DOCKER-DB]\${NC} \$1"; }
log_warning() { echo -e "\${YELLOW}[DOCKER-DB]\${NC} \$1"; }
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info "🔄 Restoring from custom format backup: $backup_basename"

# Use --clean --if-exists to drop objects before recreating (prevents schema conflicts)
# This is safe for fresh database initialization (which Docker initdb provides)
# Use --no-owner --no-privileges to avoid ownership errors
log_info "Executing: pg_restore -U $DB_USER -d $DB_NAME --no-owner --no-privileges --clean --if-exists $latest_backup"
log_info "Note: Using --clean --if-exists to prevent schema creation conflicts"

RESTORE_EXIT=0
pg_restore -U "$DB_USER" -d $DB_NAME --no-owner --no-privileges --clean --if-exists "$latest_backup" 2>&1 | tee /tmp/pg_restore.log || RESTORE_EXIT=\$?

# Check for schema creation errors (should be eliminated with --clean --if-exists, but check anyway)
SCHEMA_ERROR_ONLY=\$(grep -c "schema \"public\" already exists" /tmp/pg_restore.log 2>/dev/null || echo "0")
if [ \$RESTORE_EXIT -ne 0 ] && [ "\$SCHEMA_ERROR_ONLY" -gt 0 ]; then
  log_warning "⚠️  Schema creation error still occurred (unexpected with --clean --if-exists)"
  # Check if there are other errors
  OTHER_ERRORS=\$(grep -E "ERROR|FATAL" /tmp/pg_restore.log | grep -v "schema \"public\" already exists" | wc -l || echo "0")
  if [ "\$OTHER_ERRORS" -eq 0 ]; then
    log_info "Only schema creation error detected, treating as success..."
    RESTORE_EXIT=0
  fi
fi

if [ \$RESTORE_EXIT -ne 0 ]; then
  log_warning "⚠️  pg_restore exited with code \$RESTORE_EXIT"
  log_warning "⚠️  Check /tmp/pg_restore.log for details"
  # Don't fail completely - some objects may have been restored
  log_warning "⚠️  Continuing despite restore errors..."
else
  log_info "✅ Backup restoration completed successfully"
fi
# Mark restore completion (healthcheck will verify this)
touch /var/lib/postgresql/.restore_complete 2>/dev/null || true
EOF
        chmod +x /docker-entrypoint-initdb.d/50-restore-backup.sh
        log_success "Custom format restore script prepared"
      elif gunzip -c "$latest_backup" > /docker-entrypoint-initdb.d/50-restore-backup.sql 2>/dev/null; then
        # Plain SQL backup (gzipped)
        log_success "Plain SQL backup decompressed and prepared for restoration"
      else
        log_error "Failed to process backup file: $latest_backup"
        log_error "Backup file may be corrupted or in an unsupported format"
        exit 1
      fi
    else
      log_error "❌ No backup file found in $HISTORY_DIR"
      log_error "Backup is required when DB_OPERATION=RESTORE. Please ensure restore_*.sql.gz files exist in the history volume."
      exit 1
    fi
  else
    log_error "❌ No restore_*.sql.gz files found in $HISTORY_DIR"
    log_error "Backup is required when DB_OPERATION=RESTORE. Please ensure restore_*.sql.gz files exist in the history volume."
    exit 1
  fi
else
  # Invalid DB_OPERATION value
  log_error "❌ Invalid DB_OPERATION value: $DB_OPERATION"
  log_error "Valid values are:"
  log_error "  - RESTORE: Restore from latest backup"
  log_error "  - \"\" (empty string) or unset: Skip initialization, use existing database"
  log_error "  - seed_*.sql: Clean database and load specified seed file from seeds/ directory"
  exit 1
fi

# --- FINALIZATION SCRIPT ---------------------------------------------
if [ "$DB_OPERATION" != "" ]; then
  cat > /docker-entrypoint-initdb.d/99-finalize.sql << 'EOF'
-- Finalization Script
DO $$
BEGIN
    RAISE NOTICE '✅ Glow database initialization completed successfully!';
    RAISE NOTICE '🔗 Database is ready for connections';
    RAISE NOTICE '💡 Use "yarn migrate" to generate migrations, then restart to apply them';
END $$;
EOF
  
  # Create a marker file after all init scripts complete
  # This will be created by the postgres entrypoint after init scripts run
  cat > /docker-entrypoint-initdb.d/99-mark-ready.sh << 'EOF'
#!/bin/bash
# Mark that database initialization is complete
touch /var/lib/postgresql/.restore_complete 2>/dev/null || true
echo "[DB] Database initialization marked as complete at $(date)"
EOF
  chmod +x /docker-entrypoint-initdb.d/99-mark-ready.sh
  
  log_success "Database initialization scripts prepared"
fi

# --- START POSTGRESQL ------------------------------------------------
log_info "🚀 Starting PostgreSQL server..."

# Start PostgreSQL in the background so we can handle signals
docker-entrypoint.sh "$@" &
PG_PID=$!

log_success "PostgreSQL started with PID: $PG_PID"

# Wait for PostgreSQL to be ready
log_info "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
  sleep 1
done

log_success "PostgreSQL is ready"

# Wait for initialization scripts to complete (they run synchronously in docker-entrypoint.sh)
# Give it a moment for any init scripts to finish
sleep 3

log_success "🎉 Database is ready! Use 'yarn migrate' for schema changes."


# Wait for PostgreSQL process
wait "$PG_PID"