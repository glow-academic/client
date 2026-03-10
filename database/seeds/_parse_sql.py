"""Parse SQL INSERT statements from resource seed files into Python dict definitions."""

import os
import re
import sys

SQL_DIR = os.path.join(os.path.dirname(__file__), "..", "modules", "01-resources")

# Columns to skip (handled by create functions)
SKIP_COLUMNS = {"created_at", "active", "generated", "mcp"}

# Ordered list of files to parse
FILES = [
    "00-colors.sql",
    "01-icons.sql",
    "02-flags.sql",
    "03-roles-routes.sql",
    "04-modalities.sql",
    "05-qualities.sql",
    "06-thresholds.sql",
    "07-points.sql",
    "10-request-limits.sql",
    "11-voices.sql",
    "12-pricing.sql",
    "13-reasoning-levels.sql",
    "14-temperature-levels.sql",
    "15-operations.sql",
]

# UUID pattern
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def parse_sql_value(raw: str) -> str:
    """Convert a raw SQL value string into a Python repr string."""
    raw = raw.strip()

    # NULL
    if raw.upper() == "NULL":
        return "None"

    # Boolean
    if raw.lower() == "true":
        return "True"
    if raw.lower() == "false":
        return "False"

    # String (single-quoted)
    if raw.startswith("'") and raw.endswith("'"):
        inner = raw[1:-1].replace("''", "'")  # unescape SQL single quotes

        # Check for PostgreSQL array: {item1,item2,...}
        if inner.startswith("{") and inner.endswith("}"):
            array_inner = inner[1:-1]  # strip { and }
            if array_inner:
                items = [repr(item.strip()) for item in array_inner.split(",")]
                return "[" + ", ".join(items) + "]"
            else:
                return "[]"

        # Check if UUID
        if UUID_RE.match(inner):
            return f'UUID("{inner}")'

        # Regular string
        return repr(inner)

    # Number — int or float
    try:
        int_val = int(raw)
        return str(int_val)
    except ValueError:
        pass

    try:
        float_val = float(raw)
        return str(float_val)
    except ValueError:
        pass

    # Fallback: return as-is (shouldn't happen)
    return repr(raw)


def tokenize_values(values_str: str) -> list[str]:
    """Split the VALUES (...) content into individual value tokens,
    properly handling quoted strings and nested parens/arrays."""
    tokens = []
    current = []
    in_quote = False
    depth = 0

    i = 0
    while i < len(values_str):
        ch = values_str[i]

        if in_quote:
            current.append(ch)
            if ch == "'" and i + 1 < len(values_str) and values_str[i + 1] == "'":
                # Escaped quote
                current.append(values_str[i + 1])
                i += 2
                continue
            elif ch == "'":
                in_quote = False
        else:
            if ch == "'":
                in_quote = True
                current.append(ch)
            elif ch == "(" or ch == "{":
                depth += 1
                current.append(ch)
            elif ch == ")" or ch == "}":
                depth -= 1
                current.append(ch)
            elif ch == "," and depth == 0:
                tokens.append("".join(current).strip())
                current = []
            else:
                current.append(ch)
        i += 1

    if current:
        tokens.append("".join(current).strip())

    return tokens


def parse_insert(line: str) -> tuple[str, list[str], list[str]] | None:
    """Parse a single INSERT INTO statement. Returns (table_name, columns, values) or None."""
    # Match: INSERT INTO public.TABLE_NAME (cols) VALUES (vals) ...
    m = re.match(
        r"INSERT\s+INTO\s+public\.(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)\s*ON\s+CONFLICT",
        line,
        re.IGNORECASE,
    )
    if not m:
        return None

    table_name = m.group(1)
    columns = [c.strip() for c in m.group(2).split(",")]
    values_str = m.group(3)
    values = tokenize_values(values_str)

    return table_name, columns, values


def resource_var_name(table_name: str) -> str:
    """Convert table name like 'colors_resource' to 'colors'."""
    return table_name.replace("_resource", "")


def file_label(filename: str) -> str:
    """Convert filename like '00-colors.sql' to 'colors'."""
    base = filename.replace(".sql", "")
    # Strip leading number prefix
    parts = base.split("-", 1)
    if len(parts) > 1:
        return parts[1]
    return base


def main():
    print("from uuid import UUID")
    print()

    for filename in FILES:
        filepath = os.path.join(SQL_DIR, filename)
        if not os.path.exists(filepath):
            print(f"# WARNING: {filename} not found", file=sys.stderr)
            continue

        with open(filepath, "r") as f:
            lines = f.readlines()

        # Group rows by table name
        tables: dict[str, list[list[tuple[str, str]]]] = {}
        table_order: list[str] = []

        for line in lines:
            line = line.strip()
            if not line.startswith("INSERT"):
                continue

            result = parse_insert(line)
            if result is None:
                continue

            table_name, columns, values = result

            if len(columns) != len(values):
                print(
                    f"# WARNING: column/value count mismatch in {filename}: {len(columns)} cols vs {len(values)} vals",
                    file=sys.stderr,
                )
                continue

            # Build filtered key-value pairs
            row = []
            for col, val in zip(columns, values):
                if col in SKIP_COLUMNS:
                    continue
                row.append((col, parse_sql_value(val)))

            if table_name not in tables:
                tables[table_name] = []
                table_order.append(table_name)
            tables[table_name].append(row)

        # Output
        label = file_label(filename)
        print(f"# --- {label}.py ---")

        for table_name in table_order:
            rows = tables[table_name]
            var_name = resource_var_name(table_name)

            print(f"{var_name} = [")
            for row in rows:
                args = ", ".join(f"{col}={val}" for col, val in row)
                print(f"    dict({args}),")
            print("]")

        print()


if __name__ == "__main__":
    main()
