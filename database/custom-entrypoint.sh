#!/bin/bash
set -e

# --- CONFIG ----------------------------------------------------------
DB_USER=${POSTGRES_USER:-myuser}
DB_PASSWORD=${POSTGRES_PASSWORD:-mypassword}
DB_NAME=${POSTGRES_DB:-mydb}
INIT_SQL=${INIT_SQL:-init.sql}
INIT_DIR=${INIT_DIR:-init}

echo "Starting custom PostgreSQL entrypoint..."
echo "DB_USER: $DB_USER"
echo "DB_NAME: $DB_NAME"
echo "CLEAN_DB: ${CLEAN_DB:-false}"

# If CLEAN_DB is true, remove the data directory to force reinitialization
if [ "$CLEAN_DB" = "true" ]; then
  echo "CLEAN_DB is set to true. Cleaning database..."
  rm -rf /var/lib/postgresql/data/*
  echo "Database data directory cleaned."
fi

# Create a flag file to indicate we need to run init.sql
# This is needed because the docker-entrypoint.sh will run as PID 1
# and we can't background it properly
if [ "$CLEAN_DB" = "true" ] || [ ! -f "/var/lib/postgresql/data/PG_VERSION" ]; then
  touch /tmp/run_init_sql
  echo "Flagged for database initialization"
fi

# Prepare the initialization directory structure
# The key insight from run.sh is that we need to ensure the modular structure
# is properly accessible when the master init.sql runs
if [ -f "/$INIT_SQL" ] && [ -d "/docker-entrypoint-initdb.d" ]; then
  echo "Setting up modular database initialization..."
  
  # Create a comprehensive initialization script that mimics run.sh logic
  cat > /docker-entrypoint-initdb.d/00-modular-init.sql << 'EOF'
-- Modular Database Initialization Script
-- This script replicates the logic from run.sh for Docker environment

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Log the start of initialization
DO $$
BEGIN
    RAISE NOTICE 'Starting modular database initialization...';
END $$;
EOF

  # Copy the master init.sql file with proper path handling
  if [ -f "/$INIT_SQL" ]; then
    echo "Copying master $INIT_SQL to initialization directory..."
    
    # Create a wrapper script that handles the modular loading properly
    cat > /docker-entrypoint-initdb.d/01-execute-modular.sql << EOF
-- Execute the modular initialization
-- This ensures the \i commands can find the init directory

-- Check if we have the modular structure
DO \$\$
BEGIN
    RAISE NOTICE 'Applying database schema using modular approach...';
    RAISE NOTICE 'Found modular SQL files in $INIT_DIR directory';
    RAISE NOTICE 'Executing master $INIT_SQL which will load all modules in correct order...';
END \$\$;

-- Execute each module in the correct dependency order
-- (replicating the structure from the master init.sql)

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Independent tables (no foreign key dependencies)
\i /docker-entrypoint-initdb.d/$INIT_DIR/classes/init.sql
\i /docker-entrypoint-initdb.d/$INIT_DIR/users/init.sql
\i /docker-entrypoint-initdb.d/$INIT_DIR/agents/init.sql
\i /docker-entrypoint-initdb.d/$INIT_DIR/rubrics/init.sql

-- 2. Tables that depend on agents (scenarios references agents)
\i /docker-entrypoint-initdb.d/$INIT_DIR/scenarios/init.sql

-- 3. Tables that depend on multiple previous tables
\i /docker-entrypoint-initdb.d/$INIT_DIR/simulations/init.sql

-- 4. Evaluation system (depends on rubrics)
\i /docker-entrypoint-initdb.d/$INIT_DIR/evals/init.sql

-- Completion message
DO \$\$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'All modules loaded in dependency order.';
END \$\$;
EOF
    
    chmod 755 /docker-entrypoint-initdb.d/01-execute-modular.sql
    echo "Created modular execution script"
  fi
  
  # Copy the entire init directory structure if it exists
  if [ -d "/$INIT_DIR" ]; then
    echo "Copying modular SQL files from /$INIT_DIR to /docker-entrypoint-initdb.d/$INIT_DIR..."
    cp -r "/$INIT_DIR" "/docker-entrypoint-initdb.d/"
    chmod -R 755 "/docker-entrypoint-initdb.d/$INIT_DIR"
    echo "Copied modular SQL files to standard initialization directory"
    
    # List the copied files for debugging
    echo "Available modular files:"
    find "/docker-entrypoint-initdb.d/$INIT_DIR" -name "*.sql" -type f | sort
  else
    echo "Warning: No modular structure found at /$INIT_DIR"
    echo "Falling back to single init.sql file if available"
    
    # If no modular structure, just copy the single init.sql
    if [ -f "/$INIT_SQL" ]; then
      cp "/$INIT_SQL" "/docker-entrypoint-initdb.d/"
      chmod 755 "/docker-entrypoint-initdb.d/$INIT_SQL"
      echo "Copied single $INIT_SQL file"
    fi
  fi
  
  echo "Database initialization setup completed"
else
  echo "Warning: Required files not found for database initialization"
  echo "Expected: /$INIT_SQL and /docker-entrypoint-initdb.d directory"
fi

echo "Executing original PostgreSQL entrypoint..."
# Execute the original entrypoint script
# This will handle database initialization and run scripts in /docker-entrypoint-initdb.d/
exec docker-entrypoint.sh postgres "$@"