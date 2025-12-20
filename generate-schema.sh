#!/bin/bash
set -euo pipefail

# Database connection
DB_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
OUTPUT_FILE="schema.sql"
PG_DUMP="/opt/homebrew/opt/postgresql@18/bin/pg_dump"

echo "Generating schema.sql file..."

# Generate schema-only dump (DDL for tables + indexes + constraints, etc.) with zero data
# Excludes keycloak schema and provides cleaner format
$PG_DUMP \
    --schema-only \
    --no-owner \
    --no-privileges \
    --exclude-schema=keycloak \
    --format=plain \
    --file="$OUTPUT_FILE" \
    "$DB_URL"

echo ""
echo "Done! Generated $OUTPUT_FILE"
echo "File size: $(du -h $OUTPUT_FILE | cut -f1)"
echo "Line count: $(wc -l < $OUTPUT_FILE)"

