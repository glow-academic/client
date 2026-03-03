#!/usr/bin/env bash
#
# Concatenates database/schema/ files back into a single loadable SQL file
# for backward compatibility (Docker, tests, psql -f).
#
# Load order:
#   1. extensions.sql
#   2. enums/*.sql
#   3. tables/ (artifacts, entries, resources, junctions, connections)
#   4. indexes/ (same subfolder structure as tables/)
#   5. foreign_keys/ (same subfolder structure)
#
# Does NOT include views/ or indexes/views/ — those are loaded by bootstrap_all_sql.
#
# Usage:
#   bash database/scripts/concat_schema.sh [output_path]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(dirname "$SCRIPT_DIR")"
SCHEMA_DIR="$DB_DIR/schema"
OUTPUT="${1:-$DB_DIR/schema.sql}"

if [ ! -d "$SCHEMA_DIR" ]; then
    echo "Error: $SCHEMA_DIR not found" >&2
    exit 1
fi

TABLE_SUBFOLDERS="artifacts entries resources junctions connections"

{
    cat "$SCHEMA_DIR/extensions.sql"

    # Prerequisite functions (needed by table DEFAULT clauses)
    if [ -f "$SCHEMA_DIR/functions.sql" ]; then
        echo ""
        cat "$SCHEMA_DIR/functions.sql"
    fi

    # Enums
    for f in $(find "$SCHEMA_DIR/enums" -name '*.sql' | sort); do
        echo ""
        cat "$f"
    done

    # Tables (with inline constraints)
    for subfolder in $TABLE_SUBFOLDERS; do
        dir="$SCHEMA_DIR/tables/$subfolder"
        if [ -d "$dir" ]; then
            for f in $(find "$dir" -name '*.sql' | sort); do
                echo ""
                cat "$f"
            done
        fi
    done

    # Indexes (parallel structure, excluding views/)
    for subfolder in $TABLE_SUBFOLDERS; do
        dir="$SCHEMA_DIR/indexes/$subfolder"
        if [ -d "$dir" ]; then
            for f in $(find "$dir" -name '*.sql' | sort); do
                echo ""
                cat "$f"
            done
        fi
    done

    # Foreign keys
    for subfolder in $TABLE_SUBFOLDERS; do
        dir="$SCHEMA_DIR/foreign_keys/$subfolder"
        if [ -d "$dir" ]; then
            for f in $(find "$dir" -name '*.sql' | sort); do
                echo ""
                cat "$f"
            done
        fi
    done
} > "$OUTPUT"

echo "Concatenated schema files → $OUTPUT ($(wc -c < "$OUTPUT" | tr -d ' ') bytes)"
