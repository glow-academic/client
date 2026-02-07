#!/usr/bin/env python3
"""
Generate migration to fix developer message content.

Developer messages in the backup come in two forms:
1. Content directly in messages.content field
2. Content in message_content table (multi-part, when messages.content is NULL)

This script builds the proper content for each developer message and generates
a migration to update simulation_contents_entry.
"""

import re
import subprocess
from pathlib import Path

SCRATCH = Path(
    "/private/tmp/claude-502/-Users-ashoksaravanan-Coding-glow/061e39ec-dd18-4961-9d79-33fb27f948f9/scratchpad"
)
OUTPUT_DIR = Path(__file__).parent.parent / "migrate"


def parse_developer_messages(filepath: Path) -> tuple[dict, set]:
    """Parse messages.sql to get developer message info.

    Returns:
        - messages_with_content: message_id -> content (for those with inline content)
        - null_content_ids: set of message_ids that have NULL content
    """
    messages_with_content = {}
    null_content_ids = set()

    with open(filepath) as f:
        in_copy = False
        for line in f:
            if line.startswith("COPY public.messages"):
                in_copy = True
                continue
            if in_copy and line.strip() == "\\.":
                break
            if not in_copy:
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 7:
                content, role, msg_id = parts[2], parts[3], parts[6]
                if role == "developer":
                    if content != "\\N":
                        messages_with_content[msg_id] = content
                    else:
                        null_content_ids.add(msg_id)
    return messages_with_content, null_content_ids


def parse_message_content(filepath: Path, target_msg_ids: set) -> dict:
    """Parse message_content.sql for multi-part developer content.

    Returns:
        message_id -> concatenated content (parts joined with newlines)
    """
    content_map = {}  # msg_id -> [(idx, content)]

    with open(filepath) as f:
        in_copy = False
        for line in f:
            if line.startswith("COPY public.message_content"):
                in_copy = True
                continue
            if in_copy and line.strip() == "\\.":
                break
            if not in_copy:
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 5:
                idx, content, _, _, msg_id = parts[:5]
                if msg_id in target_msg_ids:
                    if msg_id not in content_map:
                        content_map[msg_id] = []
                    content_map[msg_id].append((int(idx), content))

    # Sort by idx and concatenate
    result = {}
    for msg_id, parts in content_map.items():
        parts.sort(key=lambda x: x[0])
        concatenated = "\n\n".join(p[1] for p in parts)
        result[msg_id] = concatenated

    return result


def parse_message_runs(filepath: Path) -> tuple[dict, dict]:
    """Parse message_runs.sql to build mappings.

    Returns:
        - msg_to_run: message_id -> backup_run_id (first occurrence)
        - msg_to_all_runs: message_id -> [all backup_run_ids]
    """
    msg_to_run = {}
    msg_to_all_runs = {}

    with open(filepath) as f:
        in_copy = False
        for line in f:
            if line.startswith("COPY public.message_runs"):
                in_copy = True
                continue
            if in_copy and line.strip() == "\\.":
                break
            if not in_copy:
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 4:
                msg_id, run_id = parts[2], parts[3]
                if msg_id not in msg_to_run:
                    msg_to_run[msg_id] = run_id
                if msg_id not in msg_to_all_runs:
                    msg_to_all_runs[msg_id] = []
                msg_to_all_runs[msg_id].append(run_id)

    return msg_to_run, msg_to_all_runs


def get_current_user_messages_per_first_run() -> dict:
    """Query current DB to get first_run_id -> user_message_id for runs with developer messages."""
    result = subprocess.run(
        [
            "psql",
            "postgresql://myuser:mypassword@localhost:5432/mydb",
            "-t",
            "-A",
            "-c",
            """
        SELECT DISTINCT ON (r.id)
            r.id as run_id,
            me_user.id as user_msg_id
        FROM runs_entry r
        JOIN messages_entry me ON me.run_id = r.id AND me.role = 'developer'
        JOIN messages_entry me_user ON me_user.run_id = r.id AND me_user.role = 'user'
        ORDER BY r.id, me_user.created_at
        """,
        ],
        capture_output=True,
        text=True,
    )

    run_to_user_msg = {}
    for line in result.stdout.strip().split("\n"):
        if "|" in line:
            run_id, user_msg_id = line.split("|")
            run_to_user_msg[run_id] = user_msg_id
    return run_to_user_msg


def escape_sql_string(s: str) -> str:
    """Escape a string for SQL."""
    s = s.replace("\\\\", "\x00BACKSLASH\x00")
    s = s.replace("\\n", "\n")
    s = s.replace("\\t", "\t")
    s = s.replace("\\r", "\r")
    s = s.replace("\x00BACKSLASH\x00", "\\")
    s = s.replace("'", "''")
    s = s.replace("\\", "\\\\")
    return s


def generate_migration(run_to_content: dict) -> str:
    """Generate the migration SQL."""
    sql_parts = []

    sql_parts.append("""-- Migration: Fix developer message content
-- Generated from backup 122 data
--
-- This migration updates simulation_contents_entry for developer messages
-- that currently only have placeholder content.

BEGIN;

DO $$ BEGIN RAISE NOTICE 'Fixing developer message content...'; END $$;

-- ============================================================================
-- STEP 1: Create temp table with run_id -> content mapping
-- ============================================================================

CREATE TEMP TABLE _developer_content (
    run_id uuid PRIMARY KEY,
    content text NOT NULL
);
""")

    # Insert mappings in batches
    sql_parts.append("\n-- Insert run -> content mapping")
    batch = []
    for run_id, content in run_to_content.items():
        escaped = escape_sql_string(content)
        batch.append(f"('{run_id}', E'{escaped}')")

        if len(batch) >= 20:
            sql_parts.append(
                "INSERT INTO _developer_content (run_id, content) VALUES\n"
                + ",\n".join(batch)
                + "\nON CONFLICT (run_id) DO NOTHING;"
            )
            batch = []

    if batch:
        sql_parts.append(
            "INSERT INTO _developer_content (run_id, content) VALUES\n"
            + ",\n".join(batch)
            + "\nON CONFLICT (run_id) DO NOTHING;"
        )

    sql_parts.append(f"""
DO $$ BEGIN RAISE NOTICE 'Loaded {len(run_to_content)} run->content mappings'; END $$;

-- ============================================================================
-- STEP 2: Update existing simulation_contents_entry for developer messages
-- ============================================================================

UPDATE simulation_contents_entry sce
SET content = dc.content,
    updated_at = NOW()
FROM messages_entry me
JOIN _developer_content dc ON dc.run_id = me.run_id
WHERE sce.message_id = me.id
  AND me.role = 'developer';

DO $$
DECLARE
    updated_count BIGINT;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % developer content entries', updated_count;
END $$;

-- ============================================================================
-- STEP 3: Cleanup and verify
-- ============================================================================

DROP TABLE _developer_content;

DO $$
DECLARE
    dev_total BIGINT;
    dev_with_real_content BIGINT;
BEGIN
    SELECT COUNT(*) INTO dev_total FROM messages_entry WHERE role = 'developer';

    SELECT COUNT(*) INTO dev_with_real_content
    FROM simulation_contents_entry sce
    JOIN messages_entry me ON me.id = sce.message_id
    WHERE me.role = 'developer'
      AND LENGTH(sce.content) > 20;

    RAISE NOTICE 'Final counts:';
    RAISE NOTICE '  Total developer messages: %', dev_total;
    RAISE NOTICE '  Developer with real content: %', dev_with_real_content;
END $$;

COMMIT;
""")

    return "\n".join(sql_parts)


def main():
    print("Parsing backup data...")

    messages_file = SCRATCH / "messages_data.sql"
    message_content_file = SCRATCH / "message_content_data.sql"
    message_runs_file = SCRATCH / "message_runs_data.sql"

    # Step 1: Get developer messages from backup
    dev_with_content, dev_null_content = parse_developer_messages(messages_file)
    print(f"  Developer messages with inline content: {len(dev_with_content)}")
    print(
        f"  Developer messages needing message_content lookup: {len(dev_null_content)}"
    )

    # Step 2: Get multi-part content for developer messages with NULL content
    multi_part_content = parse_message_content(message_content_file, dev_null_content)
    print(f"  Found multi-part content for: {len(multi_part_content)}")

    # Step 3: Merge into single dict: msg_id -> content
    all_dev_content = {**dev_with_content}
    all_dev_content.update(multi_part_content)
    print(f"  Total developer messages with content: {len(all_dev_content)}")

    # Step 4: Build mappings from message_runs
    msg_to_run, msg_to_all_runs = parse_message_runs(message_runs_file)
    print(f"  Found {len(msg_to_run)} message->run mappings")

    # Step 5: Build backup_run_id -> content (ALL runs per dev message)
    backup_run_to_content = {}
    for dev_msg_id, content in all_dev_content.items():
        if dev_msg_id in msg_to_all_runs:
            for backup_run_id in msg_to_all_runs[dev_msg_id]:
                backup_run_to_content[backup_run_id] = content
    print(f"  Backup runs with developer content: {len(backup_run_to_content)}")

    # Step 6: Get current DB mapping
    print("\nQuerying current database...")
    current_run_to_user_msg = get_current_user_messages_per_first_run()
    print(
        f"  Current runs with developer+user messages: {len(current_run_to_user_msg)}"
    )

    # Step 7: Build final mapping via user messages
    current_run_to_content = {}
    for current_run_id, user_msg_id in current_run_to_user_msg.items():
        if user_msg_id in msg_to_run:
            backup_run_id = msg_to_run[user_msg_id]
            if backup_run_id in backup_run_to_content:
                current_run_to_content[current_run_id] = backup_run_to_content[
                    backup_run_id
                ]

    print(
        f"  Matched {len(current_run_to_content)} current runs to backup developer content"
    )

    if not current_run_to_content:
        print("\nNo matches found! Cannot generate migration.")
        return

    # Step 8: Generate migration
    print("\nGenerating migration SQL...")
    sql = generate_migration(current_run_to_content)

    # Find next migration number
    existing = list(OUTPUT_DIR.glob("*.sql"))
    max_num = 0
    for f in existing:
        match = re.match(r"(\d+)_", f.name)
        if match:
            max_num = max(max_num, int(match.group(1)))

    next_num = max_num + 1
    output_file = OUTPUT_DIR / f"{next_num}_fix_developer_content.sql"

    with open(output_file, "w") as f:
        f.write(sql)

    print(f"\nGenerated: {output_file}")
    print(f"  File size: {output_file.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
