#!/usr/bin/env python3
"""
Generate migration to backfill system/developer message content.

This script:
1. Reads content data from backup 122 (extracted .sql files)
2. Maps old message_id → run_id using message_runs data
3. Generates a migration that:
   - Stores UNIQUE content with a content_id
   - Maps run_id → content_id (much smaller)
   - Inserts system/developer messages into simulation_messages_entry
   - Inserts their content into simulation_contents_entry

Usage:
    python generate_content_backfill_migration.py
"""

import hashlib
import re
from pathlib import Path

SCRATCH = Path("/private/tmp/claude-502/-Users-ashoksaravanan-Coding-glow/061e39ec-dd18-4961-9d79-33fb27f948f9/scratchpad")
OUTPUT_DIR = Path(__file__).parent.parent / "migrate"


def parse_messages_data(filepath: Path) -> tuple[dict, set]:
    """Parse messages.sql COPY data to extract system/developer messages.

    Returns:
        - messages: dict of message_id -> {role, content, created_at} for messages WITH content
        - null_content_ids: set of message_ids that have \\N content (need message_content lookup)
    """
    messages = {}  # message_id -> {role, content, created_at}
    null_content_ids = set()  # message_ids with \N content

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
                if role in ('system', 'developer'):
                    if content != '\\N':
                        messages[msg_id] = {
                            'role': role,
                            'content': content,
                            'created_at': created_at,
                        }
                    else:
                        null_content_ids.add(msg_id)

    return messages, null_content_ids


def parse_message_content_data(filepath: Path) -> dict:
    """Parse message_content.sql COPY data for multi-part developer content."""
    # message_id -> [(idx, content)]
    content_map = {}

    with open(filepath, 'r') as f:
        in_copy = False
        for line in f:
            if line.startswith("COPY public.message_content"):
                in_copy = True
                continue
            if in_copy and line.strip() == "\\.":
                break
            if not in_copy:
                continue

            # Parse: idx, content, created_at, updated_at, message_id
            parts = line.rstrip('\n').split('\t')
            if len(parts) >= 5:
                idx, content, created_at, updated_at, msg_id = parts[:5]
                if msg_id not in content_map:
                    content_map[msg_id] = []
                content_map[msg_id].append((int(idx), content))

    # Sort by idx
    for msg_id in content_map:
        content_map[msg_id].sort(key=lambda x: x[0])

    return content_map


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
    # Convert to SQL string literal escapes
    s = s.replace('\\\\', '\x00BACKSLASH\x00')  # Temp placeholder
    s = s.replace('\\n', '\n')
    s = s.replace('\\t', '\t')
    s = s.replace('\\r', '\r')
    s = s.replace('\x00BACKSLASH\x00', '\\')

    # Now escape for SQL string literal
    s = s.replace("'", "''")
    s = s.replace('\\', '\\\\')

    return s


def content_hash(s: str) -> str:
    """Generate a short hash for content deduplication."""
    return hashlib.md5(s.encode()).hexdigest()[:16]


def generate_migration(messages: dict, null_content_ids: set, message_content: dict, msg_to_runs: dict) -> str:
    """Generate the migration SQL with deduplicated content."""

    # Step 1: Build unique content table
    # content_id -> {role, idx, content}
    unique_contents = {}  # hash -> {role, idx, content}

    # Step 2: Build run_id -> [(role, content_hash, idx)] mapping
    run_to_content = {}  # run_id -> [(role, content_hash, idx)]

    # Process inline system/developer messages (those with content in messages.content)
    for msg_id, msg_data in messages.items():
        if msg_id not in msg_to_runs:
            continue

        role = msg_data['role']
        content = msg_data['content']
        c_hash = content_hash(content)

        if c_hash not in unique_contents:
            unique_contents[c_hash] = {'role': role, 'idx': 0, 'content': content}

        for run_id in msg_to_runs[msg_id]:
            if run_id not in run_to_content:
                run_to_content[run_id] = []
            run_to_content[run_id].append((role, c_hash, 0))

    # Process multi-part developer messages from message_content
    # ONLY for message_ids that had \N content (null_content_ids)
    for msg_id in null_content_ids:
        if msg_id not in msg_to_runs:
            continue
        if msg_id not in message_content:
            continue

        content_parts = message_content[msg_id]
        for idx, content in content_parts:
            c_hash = content_hash(content + str(idx))  # Include idx in hash for uniqueness

            if c_hash not in unique_contents:
                unique_contents[c_hash] = {'role': 'developer', 'idx': idx, 'content': content}

            for run_id in msg_to_runs[msg_id]:
                if run_id not in run_to_content:
                    run_to_content[run_id] = []
                run_to_content[run_id].append(('developer', c_hash, idx))

    print(f"  Unique content pieces: {len(unique_contents)}")
    print(f"  Runs with content: {len(run_to_content)}")

    # Generate SQL
    sql_parts = []

    sql_parts.append("""-- Migration: Backfill system/developer message content
-- Generated from backup 122 (2025-12-20)
--
-- This migration:
-- 1. Creates temp tables for unique content and run->content mapping
-- 2. Inserts system/developer messages into simulation_messages_entry
-- 3. Inserts content into simulation_contents_entry

BEGIN;

DO $$ BEGIN RAISE NOTICE 'Backfilling system/developer message content...'; END $$;

-- ============================================================================
-- STEP 1: Create temp tables
-- ============================================================================

CREATE TEMP TABLE _unique_content (
    content_hash text PRIMARY KEY,
    role text NOT NULL,
    idx integer NOT NULL DEFAULT 0,
    content text NOT NULL
);

CREATE TEMP TABLE _run_content_map (
    run_id uuid NOT NULL,
    role text NOT NULL,
    content_hash text NOT NULL,
    idx integer NOT NULL DEFAULT 0
);

CREATE INDEX ON _run_content_map (run_id, role);
""")

    # Insert unique content
    sql_parts.append("\n-- Insert unique content (deduplicated)")
    batch = []
    for c_hash, data in unique_contents.items():
        escaped = escape_sql_string(data['content'])
        batch.append(f"('{c_hash}', '{data['role']}', {data['idx']}, E'{escaped}')")

        if len(batch) >= 50:
            sql_parts.append("INSERT INTO _unique_content (content_hash, role, idx, content) VALUES\n" +
                           ",\n".join(batch) + ";")
            batch = []

    if batch:
        sql_parts.append("INSERT INTO _unique_content (content_hash, role, idx, content) VALUES\n" +
                        ",\n".join(batch) + ";")

    sql_parts.append(f"\nDO $$ BEGIN RAISE NOTICE 'Inserted {len(unique_contents)} unique content pieces'; END $$;\n")

    # Insert run -> content mapping
    sql_parts.append("\n-- Insert run -> content mapping")
    batch = []
    total_mappings = 0
    for run_id, mappings in run_to_content.items():
        for role, c_hash, idx in mappings:
            batch.append(f"('{run_id}', '{role}', '{c_hash}', {idx})")
            total_mappings += 1

            if len(batch) >= 500:
                sql_parts.append("INSERT INTO _run_content_map (run_id, role, content_hash, idx) VALUES\n" +
                               ",\n".join(batch) + ";")
                batch = []

    if batch:
        sql_parts.append("INSERT INTO _run_content_map (run_id, role, content_hash, idx) VALUES\n" +
                        ",\n".join(batch) + ";")

    sql_parts.append(f"""
DO $$ BEGIN RAISE NOTICE 'Inserted {total_mappings} run->content mappings'; END $$;

-- ============================================================================
-- STEP 2: Insert into simulation_messages_entry
-- For each system/developer message in messages_entry that's not in simulation_messages_entry,
-- find the chat_id via other messages in the same run
-- ============================================================================

INSERT INTO simulation_messages_entry (id, chat_id, created_at, updated_at)
SELECT DISTINCT
    me.id,
    sme_other.chat_id,
    me.created_at,
    me.updated_at
FROM messages_entry me
JOIN _run_content_map rcm ON rcm.run_id = me.run_id AND rcm.role = me.role::text
-- Find chat_id from other messages in same run
JOIN messages_entry me_other ON me_other.run_id = me.run_id AND me_other.role IN ('user', 'assistant')
JOIN simulation_messages_entry sme_other ON sme_other.id = me_other.id
WHERE me.role IN ('system', 'developer')
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
    uc.content,
    me.created_at + (uc.idx * interval '1 millisecond'),
    me.updated_at
FROM messages_entry me
JOIN simulation_messages_entry sme ON sme.id = me.id
JOIN _run_content_map rcm ON rcm.run_id = me.run_id AND rcm.role = me.role::text
JOIN _unique_content uc ON uc.content_hash = rcm.content_hash
WHERE me.role IN ('system', 'developer')
  AND NOT EXISTS (
      SELECT 1 FROM simulation_contents_entry sce
      WHERE sce.message_id = sme.id AND sce.content = uc.content
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

DROP TABLE _run_content_map;
DROP TABLE _unique_content;

DO $$
DECLARE
    sim_msg_count BIGINT;
    content_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO sim_msg_count
    FROM simulation_messages_entry sme
    JOIN messages_entry me ON me.id = sme.id
    WHERE me.role IN ('system', 'developer');

    SELECT COUNT(*) INTO content_count
    FROM simulation_contents_entry sce
    JOIN simulation_messages_entry sme ON sme.id = sce.message_id
    JOIN messages_entry me ON me.id = sme.id
    WHERE me.role IN ('system', 'developer');

    RAISE NOTICE 'Final counts:';
    RAISE NOTICE '  System/developer messages in simulation_messages_entry: %', sim_msg_count;
    RAISE NOTICE '  Content entries for system/developer messages: %', content_count;
END $$;

COMMIT;
""")

    return "\n".join(sql_parts)


def main():
    print("Parsing backup data...")

    messages_file = SCRATCH / "messages_data.sql"
    message_content_file = SCRATCH / "message_content_data.sql"
    message_runs_file = SCRATCH / "message_runs_data.sql"

    if not messages_file.exists():
        print(f"Error: {messages_file} not found")
        return

    messages, null_content_ids = parse_messages_data(messages_file)
    print(f"  Found {len(messages)} system/developer messages with inline content")
    print(f"  Found {len(null_content_ids)} system/developer messages needing message_content lookup")

    message_content = parse_message_content_data(message_content_file)
    print(f"  Found {len(message_content)} messages with multi-part content (total)")

    msg_to_runs = parse_message_runs_data(message_runs_file)
    print(f"  Found {len(msg_to_runs)} message -> run mappings")

    print("\nGenerating migration SQL...")
    sql = generate_migration(messages, null_content_ids, message_content, msg_to_runs)

    # Find next migration number
    existing = list(OUTPUT_DIR.glob("*.sql"))
    max_num = 0
    for f in existing:
        match = re.match(r"(\d+)_", f.name)
        if match:
            max_num = max(max_num, int(match.group(1)))

    next_num = max_num + 1
    output_file = OUTPUT_DIR / f"{next_num}_backfill_system_developer_content.sql"

    with open(output_file, 'w') as f:
        f.write(sql)

    print(f"\nGenerated: {output_file}")
    print(f"  File size: {output_file.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
