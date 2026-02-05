#!/usr/bin/env python3
"""
Generate migration to backfill system message content.

The backup has system messages with content, but the current database has
new message IDs. We match by run_id to populate the content.
"""

import re
from pathlib import Path

SCRATCH = Path("/private/tmp/claude-502/-Users-ashoksaravanan-Coding-glow/061e39ec-dd18-4961-9d79-33fb27f948f9/scratchpad")
OUTPUT_DIR = Path(__file__).parent.parent / "migrate"


def parse_messages_data(filepath: Path) -> dict:
    """Parse messages.sql COPY data to extract system messages with content.

    Returns:
        dict of message_id -> content for system messages
    """
    messages = {}  # message_id -> content

    with open(filepath, 'r') as f:
        in_copy = False
        for line in f:
            if line.startswith("COPY public.messages"):
                in_copy = True
                continue
            if in_copy and line.strip() == "\\.":
                break
            if not in_copy:
                continue

            # Parse tab-separated: created_at, updated_at, content, role, completed, audio, id
            parts = line.rstrip('\n').split('\t')
            if len(parts) >= 7:
                created_at, updated_at, content, role, completed, audio, msg_id = parts[:7]
                if role == 'system' and content != '\\N':
                    messages[msg_id] = content

    return messages


def parse_message_runs_data(filepath: Path) -> dict:
    """Parse message_runs.sql COPY data to get message_id -> [run_id] mapping."""
    # message_id -> [run_id]
    msg_to_runs = {}

    with open(filepath, 'r') as f:
        in_copy = False
        for line in f:
            if line.startswith("COPY public.message_runs"):
                in_copy = True
                continue
            if in_copy and line.strip() == "\\.":
                break
            if not in_copy:
                continue

            # Parse: created_at, updated_at, message_id, run_id
            parts = line.rstrip('\n').split('\t')
            if len(parts) >= 4:
                created_at, updated_at, msg_id, run_id = parts[:4]
                if msg_id not in msg_to_runs:
                    msg_to_runs[msg_id] = []
                msg_to_runs[msg_id].append(run_id)

    return msg_to_runs


def escape_sql_string(s: str) -> str:
    """Escape a string for SQL, handling postgres COPY format escapes."""
    # COPY format uses \n for newline, \t for tab, \\ for backslash
    s = s.replace('\\\\', '\x00BACKSLASH\x00')  # Temp placeholder
    s = s.replace('\\n', '\n')
    s = s.replace('\\t', '\t')
    s = s.replace('\\r', '\r')
    s = s.replace('\x00BACKSLASH\x00', '\\')

    # Now escape for SQL string literal
    s = s.replace("'", "''")
    s = s.replace('\\', '\\\\')

    return s


def generate_migration(messages: dict, msg_to_runs: dict) -> str:
    """Generate the migration SQL."""

    # Build run_id -> content mapping
    run_to_content = {}  # run_id -> content

    for msg_id, content in messages.items():
        if msg_id not in msg_to_runs:
            continue
        for run_id in msg_to_runs[msg_id]:
            # Only keep first content per run (they should all be the same)
            if run_id not in run_to_content:
                run_to_content[run_id] = content

    print(f"  Runs with system content: {len(run_to_content)}")

    # Generate SQL
    sql_parts = []

    sql_parts.append("""-- Migration: Backfill system message content
-- Generated from backup 122 (2025-12-20)
--
-- This migration populates simulation_messages_entry and simulation_contents_entry
-- for system messages that exist in messages_entry but have no content.

BEGIN;

DO $$ BEGIN RAISE NOTICE 'Backfilling system message content...'; END $$;

-- ============================================================================
-- STEP 1: Create temp table with run_id -> content mapping
-- ============================================================================

CREATE TEMP TABLE _system_content (
    run_id uuid PRIMARY KEY,
    content text NOT NULL
);
""")

    # Insert run -> content mapping in batches
    sql_parts.append("\n-- Insert run -> content mapping")
    batch = []
    for run_id, content in run_to_content.items():
        escaped = escape_sql_string(content)
        batch.append(f"('{run_id}', E'{escaped}')")

        if len(batch) >= 20:
            sql_parts.append("INSERT INTO _system_content (run_id, content) VALUES\n" +
                           ",\n".join(batch) + "\nON CONFLICT (run_id) DO NOTHING;")
            batch = []

    if batch:
        sql_parts.append("INSERT INTO _system_content (run_id, content) VALUES\n" +
                        ",\n".join(batch) + "\nON CONFLICT (run_id) DO NOTHING;")

    sql_parts.append(f"""
DO $$ BEGIN RAISE NOTICE 'Loaded {len(run_to_content)} run->content mappings'; END $$;

-- ============================================================================
-- STEP 2: Insert into simulation_messages_entry
-- For system messages that exist in messages_entry but not in simulation_messages_entry
-- ============================================================================

INSERT INTO simulation_messages_entry (id, chat_id, created_at, updated_at)
SELECT DISTINCT
    me.id,
    sme_other.chat_id,
    me.created_at,
    me.updated_at
FROM messages_entry me
JOIN _system_content sc ON sc.run_id = me.run_id
-- Find chat_id from other messages in same run
JOIN messages_entry me_other ON me_other.run_id = me.run_id AND me_other.role IN ('user', 'assistant')
JOIN simulation_messages_entry sme_other ON sme_other.id = me_other.id
WHERE me.role = 'system'
  AND NOT EXISTS (SELECT 1 FROM simulation_messages_entry sme WHERE sme.id = me.id)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
    inserted_count BIGINT;
BEGIN
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Inserted % rows into simulation_messages_entry', inserted_count;
END $$;

-- ============================================================================
-- STEP 3: Insert content into simulation_contents_entry
-- ============================================================================

INSERT INTO simulation_contents_entry (message_id, content, created_at, updated_at)
SELECT
    sme.id,
    sc.content,
    me.created_at,
    me.updated_at
FROM messages_entry me
JOIN simulation_messages_entry sme ON sme.id = me.id
JOIN _system_content sc ON sc.run_id = me.run_id
WHERE me.role = 'system'
  AND NOT EXISTS (
      SELECT 1 FROM simulation_contents_entry sce
      WHERE sce.message_id = sme.id
  );

DO $$
DECLARE
    inserted_count BIGINT;
BEGIN
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Inserted % content rows into simulation_contents_entry', inserted_count;
END $$;

-- ============================================================================
-- STEP 4: Cleanup and verify
-- ============================================================================

DROP TABLE _system_content;

DO $$
DECLARE
    system_in_sim BIGINT;
    system_with_content BIGINT;
    system_total BIGINT;
BEGIN
    SELECT COUNT(*) INTO system_total FROM messages_entry WHERE role = 'system';

    SELECT COUNT(*) INTO system_in_sim
    FROM simulation_messages_entry sme
    JOIN messages_entry me ON me.id = sme.id
    WHERE me.role = 'system';

    SELECT COUNT(*) INTO system_with_content
    FROM simulation_contents_entry sce
    JOIN simulation_messages_entry sme ON sme.id = sce.message_id
    JOIN messages_entry me ON me.id = sme.id
    WHERE me.role = 'system';

    RAISE NOTICE 'Final counts:';
    RAISE NOTICE '  Total system messages: %', system_total;
    RAISE NOTICE '  System in simulation_messages_entry: %', system_in_sim;
    RAISE NOTICE '  System with content: %', system_with_content;
END $$;

COMMIT;
""")

    return "\n".join(sql_parts)


def main():
    print("Parsing backup data...")

    messages_file = SCRATCH / "messages_data.sql"
    message_runs_file = SCRATCH / "message_runs_data.sql"

    if not messages_file.exists():
        print(f"Error: {messages_file} not found")
        return

    messages = parse_messages_data(messages_file)
    print(f"  Found {len(messages)} unique system messages with content")

    msg_to_runs = parse_message_runs_data(message_runs_file)
    print(f"  Found {len(msg_to_runs)} message -> run mappings")

    # Filter to only system messages
    system_msg_ids = set(messages.keys())
    msg_to_runs = {k: v for k, v in msg_to_runs.items() if k in system_msg_ids}
    print(f"  System messages with run mappings: {len(msg_to_runs)}")

    print("\nGenerating migration SQL...")
    sql = generate_migration(messages, msg_to_runs)

    # Find next migration number
    existing = list(OUTPUT_DIR.glob("*.sql"))
    max_num = 0
    for f in existing:
        match = re.match(r"(\d+)_", f.name)
        if match:
            max_num = max(max_num, int(match.group(1)))

    next_num = max_num + 1
    output_file = OUTPUT_DIR / f"{next_num}_backfill_system_content.sql"

    with open(output_file, 'w') as f:
        f.write(sql)

    print(f"\nGenerated: {output_file}")
    print(f"  File size: {output_file.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
