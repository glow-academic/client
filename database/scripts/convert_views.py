#!/usr/bin/env python3
"""
Convert MV files from 6-step ceremony format to pure CREATE + separate indexes.

Reads from database/schema/views/ (hand-maintained MV files with DROP/CREATE/INDEX/REFRESH)
and writes:
  - database/schema/views/<name>.sql         — pure CREATE MATERIALIZED VIEW ... WITH NO DATA
  - database/schema/indexes/views/<name>.sql  — CREATE INDEX statements for the MV

Usage:
    python database/scripts/convert_views.py
"""

import os
import re
import sys


def parse_mv_file(path: str) -> tuple[str, list[str], str, list[str]]:
    """Parse a 6-step MV file and extract components.

    Returns:
        (header_comment, create_mv_lines, mv_name, create_index_lines)
    """
    with open(path, "r") as f:
        content = f.read()

    lines = content.split("\n")

    # Extract header comment (lines before first ===== separator)
    header_lines: list[str] = []
    for line in lines:
        if "=====" in line:
            break
        header_lines.append(line)
    # Strip trailing empty lines from header
    while header_lines and header_lines[-1].strip() == "":
        header_lines.pop()

    # Extract CREATE MATERIALIZED VIEW block
    create_mv_lines: list[str] = []
    in_create = False
    for line in lines:
        if re.match(r"^CREATE MATERIALIZED VIEW\b", line, re.IGNORECASE):
            in_create = True
        if in_create:
            create_mv_lines.append(line)
            if line.strip().upper().startswith("WITH NO DATA") or line.strip().upper().endswith("WITH NO DATA;"):
                break

    # Extract MV name from CREATE statement
    mv_name = ""
    for line in create_mv_lines:
        m = re.match(r"CREATE MATERIALIZED VIEW\s+(\w+)", line, re.IGNORECASE)
        if m:
            mv_name = m.group(1)
            break

    # Extract CREATE INDEX statements (may span multiple lines)
    create_index_blocks: list[str] = []
    i = 0
    while i < len(lines):
        if re.match(r"^CREATE\s+(UNIQUE\s+)?INDEX\b", lines[i], re.IGNORECASE):
            block_lines = [lines[i]]
            # Collect continuation lines until we hit a semicolon
            while not block_lines[-1].rstrip().endswith(";") and i + 1 < len(lines):
                i += 1
                block_lines.append(lines[i])
            create_index_blocks.append("\n".join(block_lines))
        i += 1

    return "\n".join(header_lines), create_mv_lines, mv_name, create_index_blocks


def convert_views(schema_dir: str) -> tuple[int, int]:
    """Convert all MV files in views/ subdirectories.

    Rewrites views/ as a flat folder of pure CREATE MV files.
    Writes MV indexes to indexes/views/.
    """
    views_dir = os.path.join(schema_dir, "views")
    indexes_views_dir = os.path.join(schema_dir, "indexes", "views")

    if not os.path.exists(views_dir):
        print(f"Error: {views_dir} not found", file=sys.stderr)
        return 0, 0

    # Collect all .sql files from subdirectories
    mv_files: list[str] = []
    for root, _, files in os.walk(views_dir):
        for f in files:
            if f.endswith(".sql"):
                mv_files.append(os.path.join(root, f))
    mv_files.sort()

    # Parse all MV files first
    parsed: list[tuple[str, str, list[str], str, list[str]]] = []
    for path in mv_files:
        basename = os.path.basename(path).replace(".sql", "")
        header, create_lines, mv_name, index_lines = parse_mv_file(path)
        if not create_lines:
            print(f"  WARNING: No CREATE MV found in {path}")
            continue
        parsed.append((basename, header, create_lines, mv_name, index_lines))

    # Remove old subdirectory structure
    for item in os.listdir(views_dir):
        item_path = os.path.join(views_dir, item)
        if os.path.isdir(item_path):
            import shutil
            shutil.rmtree(item_path)

    # Write flat view files
    os.makedirs(indexes_views_dir, exist_ok=True)
    view_count = 0
    index_count = 0

    for basename, header, create_lines, mv_name, index_lines in parsed:
        # Write pure CREATE MV file
        view_path = os.path.join(views_dir, f"{basename}.sql")
        with open(view_path, "w") as f:
            f.write(header + "\n\n")
            f.write("\n".join(create_lines))
            if not create_lines[-1].endswith("\n"):
                f.write("\n")
        view_count += 1

        # Write MV index file (if any indexes)
        if index_lines:
            idx_path = os.path.join(indexes_views_dir, f"{basename}.sql")
            with open(idx_path, "w") as f:
                f.write(f"-- Indexes for materialized view: {mv_name}\n")
                f.write("--\n\n")
                f.write("\n\n".join(index_lines))
                f.write("\n")
            index_count += len(index_lines)

    return view_count, index_count


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_dir = os.path.dirname(script_dir)
    schema_dir = os.path.join(db_dir, "schema")

    print(f"Converting MV files in {schema_dir}/views/")
    view_count, index_count = convert_views(schema_dir)
    print(f"  Wrote {view_count} pure CREATE MV files → views/")
    print(f"  Extracted {index_count} indexes → indexes/views/")


if __name__ == "__main__":
    main()
