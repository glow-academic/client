#!/usr/bin/env bash
#
# Concatenates database/schema/ files back into a single loadable SQL file
# for backward compatibility (Docker, tests, psql -f).
#
# Load order:
#   1. extensions.sql
#   2. enums/*.sql
#   3. tables/artifacts/*.sql, entries/*.sql, resources/*.sql, junctions/*.sql, connections/*.sql
#   4. constraints.sql
#   5. indexes.sql
#   6. foreign_keys.sql
#
# Does NOT include views/ — those are loaded separately by bootstrap_all_sql.
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

{
    cat "$SCHEMA_DIR/extensions.sql"

    for f in $(find "$SCHEMA_DIR/enums" -name '*.sql' | sort); do
        echo ""
        cat "$f"
    done

    # Tables: artifacts first, then entries, resources, junctions, connections
    for subfolder in artifacts entries resources junctions connections; do
        dir="$SCHEMA_DIR/tables/$subfolder"
        if [ -d "$dir" ]; then
            for f in $(find "$dir" -name '*.sql' | sort); do
                echo ""
                cat "$f"
            done
        fi
    done

    echo ""
    cat "$SCHEMA_DIR/constraints.sql"
    echo ""
    cat "$SCHEMA_DIR/indexes.sql"
    echo ""
    cat "$SCHEMA_DIR/foreign_keys.sql"
} > "$OUTPUT"

echo "Concatenated schema files → $OUTPUT ($(wc -c < "$OUTPUT" | tr -d ' ') bytes)"
