#!/bin/bash
set -e

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
fi

# Copy init.sql and all modular SQL files to the standard initialization directory
# This ensures they run during the standard PostgreSQL initialization process
if [ -f "/init.sql" ] && [ -d "/docker-entrypoint-initdb.d" ]; then
  # Copy the master init.sql file
  cp /init.sql /docker-entrypoint-initdb.d/
  chmod 755 /docker-entrypoint-initdb.d/init.sql
  echo "Copied master init.sql to standard initialization directory"
  
  # Copy the entire init directory structure if it exists
  if [ -d "/init" ]; then
    cp -r /init /docker-entrypoint-initdb.d/
    chmod -R 755 /docker-entrypoint-initdb.d/init
    echo "Copied modular SQL files to standard initialization directory"
  fi
fi

# Execute the original entrypoint script
# This will handle database initialization and run scripts in /docker-entrypoint-initdb.d/
exec docker-entrypoint.sh postgres "$@"