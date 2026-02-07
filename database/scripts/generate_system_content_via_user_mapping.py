#!/usr/bin/env python3
"""
Generate migration to backfill system message content.

Strategy:
1. Parse backup to build: backup_run_id -> system_content
2. Parse backup to build: user_message_id -> backup_run_id
3. Query current DB to get: current_run_id -> user_message_id
4. Chain: current_run_id -> user_message_id -> backup_run_id -> system_content
5. Generate migration that populates simulation tables
"""

import re
import subprocess
from pathlib import Path

SCRATCH = Path(
    "/private/tmp/claude-502/-Users-ashoksaravanan-Coding-glow/061e39ec-dd18-4961-9d79-33fb27f948f9/scratchpad"
)
OUTPUT_DIR = Path(__file__).parent.parent / "migrate"


def parse_system_messages(filepath: Path) -> dict:
    """Parse messages.sql to get message_id -> content for system messages."""
    messages = {}
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
                if role == "system" and content != "\\N":
                    messages[msg_id] = content
    return messages


def parse_message_runs(filepath: Path) -> tuple[dict, dict, dict]:
    """Parse message_runs.sql to build mappings.

    Returns:
        - run_to_msgs: backup_run_id -> [message_ids]
        - msg_to_run: message_id -> backup_run_id (first occurrence)
        - msg_to_all_runs: message_id -> [all backup_run_ids]
    """
    run_to_msgs = {}
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
                if run_id not in run_to_msgs:
                    run_to_msgs[run_id] = []
                run_to_msgs[run_id].append(msg_id)
                if msg_id not in msg_to_run:
                    msg_to_run[msg_id] = run_id
                if msg_id not in msg_to_all_runs:
                    msg_to_all_runs[msg_id] = []
                msg_to_all_runs[msg_id].append(run_id)

    return run_to_msgs, msg_to_run, msg_to_all_runs


def get_current_user_messages_per_first_run() -> dict:
    """Query current DB to get first_run_id -> user_message_id for runs with system messages."""
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
        JOIN messages_entry me ON me.run_id = r.id AND me.role = 'system'
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

    sql_parts.append("""-- Migration: Backfill system message content (via user message mapping)
-- Generated from backup 122 data
--
-- This migration populates simulation_messages_entry and simulation_contents_entry
-- for system messages by matching user messages that exist in both backup and current DB.

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

    # Insert mappings in batches
    sql_parts.append("\n-- Insert run -> content mapping")
    batch = []
    for run_id, content in run_to_content.items():
        escaped = escape_sql_string(content)
        batch.append(f"('{run_id}', E'{escaped}')")

        if len(batch) >= 20:
            sql_parts.append(
                "INSERT INTO _system_content (run_id, content) VALUES\n"
                + ",\n".join(batch)
                + "\nON CONFLICT (run_id) DO NOTHING;"
            )
            batch = []

    if batch:
        sql_parts.append(
            "INSERT INTO _system_content (run_id, content) VALUES\n"
            + ",\n".join(batch)
            + "\nON CONFLICT (run_id) DO NOTHING;"
        )

    sql_parts.append(f"""
DO $$ BEGIN RAISE NOTICE 'Loaded {len(run_to_content)} run->content mappings'; END $$;

-- ============================================================================
-- STEP 2: Insert into simulation_messages_entry
-- ============================================================================

INSERT INTO simulation_messages_entry (id, chat_id, created_at, updated_at)
SELECT DISTINCT
    me.id,
    sme_other.chat_id,
    me.created_at,
    me.updated_at
FROM messages_entry me
JOIN _system_content sc ON sc.run_id = me.run_id
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
      SELECT 1 FROM simulation_contents_entry sce WHERE sce.message_id = sme.id
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
    system_total BIGINT;
    system_in_sim BIGINT;
    system_with_content BIGINT;
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

    # Step 1: Get system messages from backup
    system_messages = parse_system_messages(messages_file)
    print(f"  Found {len(system_messages)} unique system messages in backup")

    # Step 2: Build mappings from message_runs
    run_to_msgs, msg_to_run, msg_to_all_runs = parse_message_runs(message_runs_file)
    print(f"  Found {len(run_to_msgs)} backup runs")

    # Step 3: Build backup_run_id -> system_content (ALL runs per system message)
    backup_run_to_content = {}
    for sys_msg_id, content in system_messages.items():
        if sys_msg_id in msg_to_all_runs:
            for backup_run_id in msg_to_all_runs[sys_msg_id]:
                backup_run_to_content[backup_run_id] = content
    print(f"  Backup runs with system content: {len(backup_run_to_content)}")

    # Step 4: Get current DB mapping: run_id -> user_message_id
    print("\nQuerying current database...")
    current_run_to_user_msg = get_current_user_messages_per_first_run()
    print(f"  Current runs with system+user messages: {len(current_run_to_user_msg)}")

    # Step 5: Build final mapping: current_run_id -> content
    # By matching: current_user_msg -> backup_run_id (via msg_to_run) -> content
    current_run_to_content = {}
    matched = 0
    for current_run_id, user_msg_id in current_run_to_user_msg.items():
        if user_msg_id in msg_to_run:
            backup_run_id = msg_to_run[user_msg_id]
            if backup_run_id in backup_run_to_content:
                current_run_to_content[current_run_id] = backup_run_to_content[
                    backup_run_id
                ]
                matched += 1

    print(f"  Matched {matched} current runs to backup system content")

    if not current_run_to_content:
        print("\nNo matches found! Cannot generate migration.")
        return

    # Step 6: Generate migration
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
    output_file = (
        OUTPUT_DIR / f"{next_num}_backfill_system_content_via_user_mapping.sql"
    )

    with open(output_file, "w") as f:
        f.write(sql)

    print(f"\nGenerated: {output_file}")
    print(f"  File size: {output_file.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
