#!/bin/bash
set -e

# If CLEAN_DB is true, remove the data directory to force reinitialization
if [ "$CLEAN_DB" = "true" ]; then
  echo "CLEAN_DB is set to true. Cleaning database..."
  rm -rf /var/lib/postgresql/data/*
  echo "Database data directory cleaned."
  
  # Set a flag to indicate we need to initialize
  export POSTGRES_INITDB_ARGS="--auth-host=trust"
fi

# Start PostgreSQL with the original entrypoint
# This will run initialization scripts in /docker-entrypoint-initdb.d/
docker-entrypoint.sh postgres "$@" &
PG_PID=$!

# If we're cleaning the DB, make sure init.sql is executed
if [ "$CLEAN_DB" = "true" ]; then
  # Wait for PostgreSQL to start
  until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
    echo "Waiting for PostgreSQL to start..."
    sleep 1
  done
  
  echo "PostgreSQL started. Running initialization script..."
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /init.sql
  echo "Initialization script executed successfully."
fi

# Wait for the PostgreSQL process to finish
wait $PG_PID