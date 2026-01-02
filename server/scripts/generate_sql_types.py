#!/usr/bin/env python3
"""Generate Python type files from SQL introspection.

Walks all SQL files, introspects them, and generates Pydantic models
for request/response types.
"""

import asyncio
import os
import re
import sys
from pathlib import Path

import asyncpg  # type: ignore

# Version constant - change this to switch versions (e.g., 'v4', 'v5')
VERSION = "v4"

# Add server directory to path for imports
server_dir = Path(__file__).parent.parent
sys.path.insert(0, str(server_dir))

from scripts.sql_introspect import introspect_sql_file
from scripts.sql_typegen import generate_types_file
from utils.sql_helper import load_sql


def _to_class_name(route_name: str, suffix: str) -> str:
    """Generate class name from route name.

    Args:
        route_name: Route name (e.g., "create_agent")
        suffix: Suffix (e.g., "SqlParams", "SqlRow")

    Returns:
        Class name (e.g., "CreateAgentSqlParams")
    """
    # Convert snake_case to PascalCase
    parts = route_name.split("_")
    pascal = "".join(word.capitalize() for word in parts)
    return f"{pascal}{suffix}"


def _sql_path_to_route_name(sql_path: str) -> str | None:
    """Extract route name from SQL file path.

    Example:
        f"app/sql/{VERSION}/agents/create_agent_complete.sql" -> "create_agent"
        f"tests/sql/{VERSION}/integration/infra/activity/insert_test_profile.sql" -> "insert_test_profile"

    Args:
        sql_path: SQL file path relative to server root

    Returns:
        Route name or None if pattern doesn't match
    """
    app_sql_prefix = f"app/sql/{VERSION}/"
    tests_sql_prefix = f"tests/sql/{VERSION}/integration/"

    # Pattern: app/sql/{VERSION}/[resource]/[operation]_complete.sql
    # Pattern: app/sql/{VERSION}/infrastructure/infrastructure_[category]_[operation]_complete.sql -> infra_[category]_[operation]
    if sql_path.startswith(app_sql_prefix):
        relative = sql_path[len(app_sql_prefix) :]
        parts = relative.split("/")
        # Handle infrastructure paths: infrastructure/[category]/[operation]_complete.sql
        if len(parts) == 3 and parts[0] == "infrastructure":
            category, filename = parts[1], parts[2]
            if not filename.endswith("_complete.sql"):
                return None
            operation = filename[: -len("_complete.sql")]
            return f"infra_{category}_{operation}".replace("-", "_")
        # Handle standard paths: [resource]/[operation]_complete.sql
        if len(parts) != 2:
            return None
        resource, filename = parts
        if not filename.endswith("_complete.sql"):
            return None
        operation = filename[: -len("_complete.sql")]
        return operation.replace("-", "_")

    # Pattern: tests/sql/{VERSION}/integration/infra/[resource]/[operation].sql
    if sql_path.startswith(f"{tests_sql_prefix}infra/"):
        relative = sql_path[len(f"{tests_sql_prefix}infra/") :]
        parts = relative.split("/")
        if len(parts) != 2:
            return None
        resource, filename = parts
        if not filename.endswith(".sql"):
            return None
        operation = filename[: -len(".sql")]
        return operation.replace("-", "_")

    # Pattern: tests/sql/{VERSION}/integration/socket/[operation].sql
    if sql_path.startswith(f"{tests_sql_prefix}socket/"):
        relative = sql_path[len(f"{tests_sql_prefix}socket/") :]
        if not relative.endswith(".sql"):
            return None
        operation = relative[: -len(".sql")]
        return operation.replace("-", "_")

    # Pattern: tests/sql/{VERSION}/integration/api/[resource]/test_[operation]_v4_complete.sql
    if sql_path.startswith(f"{tests_sql_prefix}api/"):
        relative = sql_path[len(f"{tests_sql_prefix}api/") :]
        if not relative.endswith("_complete.sql"):
            return None
        # Extract resource and operation: [resource]/test_[operation]_v4_complete.sql
        parts = relative.split("/")
        if len(parts) != 2:
            return None
        resource, filename = parts
        # Remove test_ prefix and _v4_complete.sql suffix
        operation = filename[: -len("_complete.sql")]
        if operation.startswith("test_"):
            operation = operation[len("test_") :]
        if operation.endswith(f"_{VERSION}"):
            operation = operation[: -len(f"_{VERSION}")]
        return operation.replace("-", "_")

    # Pattern: tests/sql/{VERSION}/integration/helpers/test_[operation]_v4_complete.sql
    if sql_path.startswith(f"{tests_sql_prefix}helpers/"):
        relative = sql_path[len(f"{tests_sql_prefix}helpers/") :]
        if not relative.endswith("_complete.sql"):
            return None
        # Remove test_ prefix and _v4_complete.sql suffix
        operation = relative[: -len("_complete.sql")]
        if operation.startswith("test_"):
            operation = operation[len("test_") :]
        if operation.endswith(f"_{VERSION}"):
            operation = operation[: -len(f"_{VERSION}")]
        return operation.replace("-", "_")

    # Pattern: tests/sql/{VERSION}/integration/conftest/test_[operation]_v4_complete.sql
    if sql_path.startswith(f"{tests_sql_prefix}conftest/"):
        relative = sql_path[len(f"{tests_sql_prefix}conftest/") :]
        if not relative.endswith("_complete.sql"):
            return None
        # Remove test_ prefix and _v4_complete.sql suffix
        operation = relative[: -len("_complete.sql")]
        if operation.startswith("test_"):
            operation = operation[len("test_") :]
        if operation.endswith(f"_{VERSION}"):
            operation = operation[: -len(f"_{VERSION}")]
        return operation.replace("-", "_")

    return None


def generate_registry_entry(
    sql_path: str, route_name: str
) -> tuple[str, str, str, str, str, str] | None:
    """Generate registry entry for a SQL file.

    Args:
        sql_path: SQL file path (e.g., f"app/sql/{VERSION}/agents/get_agent_new_complete.sql")
        route_name: Route name (e.g., "get_agent_new")

    Returns:
        Tuple of (registry_type, sql_path, sql_params_class, sql_row_class, api_request_class, api_response_class) or None if invalid
        registry_type is either "app" or "test"
    """
    app_sql_prefix = f"app/sql/{VERSION}/"
    tests_sql_prefix = f"tests/sql/{VERSION}/integration/"

    # Process app/sql/{VERSION}/ files
    if sql_path.startswith(app_sql_prefix):
        # Generate class names
        sql_params_class = _to_class_name(route_name, "SqlParams")
        sql_row_class = _to_class_name(route_name, "SqlRow")
        api_request_class = _to_class_name(route_name, "ApiRequest")
        api_response_class = _to_class_name(route_name, "ApiResponse")

        return (
            "app",
            sql_path,
            sql_params_class,
            sql_row_class,
            api_request_class,
            api_response_class,
        )

    # Process test SQL files
    if sql_path.startswith(tests_sql_prefix):
        # Generate class names
        sql_params_class = _to_class_name(route_name, "SqlParams")
        sql_row_class = _to_class_name(route_name, "SqlRow")
        api_request_class = _to_class_name(route_name, "ApiRequest")
        api_response_class = _to_class_name(route_name, "ApiResponse")

        return (
            "test",
            sql_path,
            sql_params_class,
            sql_row_class,
            api_request_class,
            api_response_class,
        )

    return None


def write_consolidated_types_file(
    type_definitions: list[tuple[str, str, str, str, str, str, str]],
    registry_type: str,
    server_root: Path,
) -> None:
    """Write consolidated types.py file with all class definitions and registry.

    Args:
        type_definitions: List of (sql_path, route_name, types_content, sql_params_class, sql_row_class, api_request_class, api_response_class) tuples
        registry_type: Either "app" or "test"
        server_root: Server root directory
    """
    if registry_type == "app":
        types_file = server_root / "app" / "sql" / "types.py"
    else:
        types_file = server_root / "tests" / "sql" / "types.py"

    # Collect all unique imports
    all_imports: set[str] = set()
    all_imports.add("from typing import Any")
    all_imports.add(
        "from typing import TYPE_CHECKING, Literal, Type, TypeVar, overload, cast"
    )
    all_imports.add("from pydantic import BaseModel")

    # Scan type definitions for imports
    for _, _, types_content, _, _, _, _ in type_definitions:
        for line in types_content.split("\n"):
            if line.startswith("from typing import"):
                all_imports.add(line)
            elif line.startswith("from uuid import"):
                all_imports.add(line)
            elif line.startswith("from pydantic import"):
                # Merge pydantic imports
                if "Field" in line:
                    all_imports.add("from pydantic import Field")

    # Sort imports
    typing_imports = sorted(
        [imp for imp in all_imports if imp.startswith("from typing")]
    )
    uuid_imports = sorted([imp for imp in all_imports if imp.startswith("from uuid")])
    pydantic_imports = sorted(
        [imp for imp in all_imports if imp.startswith("from pydantic")]
    )

    lines = [
        '"""SQL type definitions and registry - AUTO-GENERATED - DO NOT EDIT MANUALLY.',
        "",
        "This file is automatically generated by sql-compile. All edits will be overwritten.",
        '"""',
        "",
    ]

    # Add imports
    for imp in typing_imports:
        lines.append(imp)
    if uuid_imports:
        lines.append("")
        for imp in uuid_imports:
            lines.append(imp)
    if pydantic_imports:
        lines.append("")
        for imp in pydantic_imports:
            lines.append(imp)

    lines.append("")
    lines.append("")
    lines.append("# Type variables for generic return types")
    lines.append('TInput = TypeVar("TInput", bound=BaseModel)')
    lines.append('TOutput = TypeVar("TOutput", bound=BaseModel)')
    lines.append("")
    lines.append("# Type alias for SQL strings loaded from files (semantic clarity)")
    lines.append("SqlString = str")
    lines.append("")
    lines.append("")
    lines.append(
        "# ============================================================================"
    )
    lines.append("# TYPE DEFINITIONS")
    lines.append(
        "# ============================================================================"
    )
    lines.append("")

    # Track which classes have already been written to avoid duplicates
    written_classes: set[str] = set()

    # Add all class definitions
    for _, sql_path, types_content, _, _, _, _ in sorted(
        type_definitions, key=lambda x: x[0]
    ):
        # Split types_content by triple newlines to get each class section
        sections = types_content.split("\n\n\n")

        # Add comment for this SQL file
        lines.append("")
        lines.append(f"# Generated from: {sql_path}")
        lines.append("")

        for section in sections:
            section_lines = section.split("\n")
            class_lines: list[str] = []
            in_docstring = False
            docstring_delimiter = None
            class_name: str | None = None

            for line in section_lines:
                # Skip imports
                if line.strip().startswith("from ") or line.strip().startswith(
                    "import "
                ):
                    continue

                # Extract class name if this is a class definition line
                stripped = line.strip()
                if stripped.startswith("class ") and "(" in stripped:
                    # Extract class name: "class ClassName(BaseModel):" -> "ClassName"
                    class_match = stripped.split("(")[0].replace("class", "").strip()
                    if class_match:
                        class_name = class_match

                # Track docstrings
                if stripped.startswith('"""') or stripped.startswith("'''"):
                    # Check if it's opening or closing
                    quote_count = stripped.count('"""') + stripped.count("'''")
                    if quote_count == 2 or (
                        stripped.startswith('"""')
                        and stripped.endswith('"""')
                        and len(stripped) > 3
                    ):
                        # Single-line docstring, skip it
                        continue
                    elif not in_docstring:
                        # Opening docstring
                        in_docstring = True
                        docstring_delimiter = '"""' if '"""' in stripped else "'''"
                        continue
                    elif (
                        in_docstring
                        and docstring_delimiter is not None
                        and (docstring_delimiter in stripped)
                    ):
                        # Closing docstring
                        in_docstring = False
                        docstring_delimiter = None
                        continue

                # Skip lines inside docstrings
                if in_docstring:
                    continue

                # Include everything else (class definitions and their content)
                class_lines.append(line)

            # Check if this class has already been written
            if class_name and class_name in written_classes:
                # Skip duplicate class definition
                continue

            # Add the class definition (skip if empty)
            if class_lines and any(l.strip().startswith("class ") for l in class_lines):
                # Track written classes and handle duplicate fields
                if class_name:
                    written_classes.add(class_name)
                    # First pass: collect all fields to detect empty classes
                    field_names: set[str] = set()
                    classes_info: list[
                        dict
                    ] = []  # Store info for each class: {start_idx, indent, has_fields}
                    current_class_info: dict | None = None
                    in_class = False

                    for cls_line in class_lines:
                        stripped_line = cls_line.strip()
                        if stripped_line.startswith("class ") and "(" in stripped_line:
                            # Save previous class info
                            if current_class_info is not None:
                                classes_info.append(current_class_info)
                            # Start new class
                            in_class = True
                            class_indent = cls_line[
                                : len(cls_line) - len(cls_line.lstrip())
                            ]
                            current_class_info = {
                                "start_idx": len(class_lines),  # Will be updated
                                "indent": class_indent,
                                "has_fields": False,
                                "has_pass": False,
                            }
                        elif (
                            in_class
                            and stripped_line
                            and not stripped_line.startswith('"""')
                            and not stripped_line.startswith("'''")
                            and not stripped_line.startswith("#")
                        ):
                            if ":" in stripped_line:
                                field_match = stripped_line.split(":")[0].strip()
                                if field_match and field_match not in (
                                    "pass",
                                    "def",
                                    "return",
                                ):
                                    if current_class_info:
                                        current_class_info["has_fields"] = True
                            elif stripped_line == "pass":
                                if current_class_info:
                                    current_class_info["has_pass"] = True

                    # Save last class info
                    if current_class_info is not None:
                        classes_info.append(current_class_info)

                    # Second pass: process lines and check for duplicate fields
                    deduplicated_lines: list[str] = []
                    in_class = False
                    field_names.clear()

                    for cls_line in class_lines:
                        stripped_line = cls_line.strip()
                        # Detect class definition start
                        if stripped_line.startswith("class ") and "(" in stripped_line:
                            # Clear field_names when starting a new class to avoid cross-class deduplication
                            field_names.clear()
                            in_class = True
                            deduplicated_lines.append(cls_line)
                            continue
                        # Detect class end (empty line or next class)
                        if in_class and (
                            not stripped_line or stripped_line.startswith("class ")
                        ):
                            if not stripped_line:
                                deduplicated_lines.append(cls_line)
                            else:
                                # Next class starts
                                in_class = False
                                deduplicated_lines.append(cls_line)
                            continue
                        # Within class, check for duplicate field definitions
                        if (
                            in_class
                            and ":" in stripped_line
                            and not stripped_line.startswith("#")
                        ):
                            # Extract field name: "field_name: type" -> "field_name"
                            field_match = stripped_line.split(":")[0].strip()
                            if field_match and field_match not in (
                                "pass",
                                "def",
                                "return",
                            ):
                                if field_match in field_names:
                                    # Skip duplicate field
                                    continue
                                field_names.add(field_match)
                        deduplicated_lines.append(cls_line)

                    # Final pass: add pass to empty classes by scanning deduplicated_lines
                    final_lines: list[str] = []
                    i = 0
                    while i < len(deduplicated_lines):
                        line = deduplicated_lines[i]
                        final_lines.append(line)
                        stripped = line.strip()

                        if stripped.startswith("class ") and "(" in stripped:
                            # Check if this class has any content before next class
                            class_indent = line[: len(line) - len(line.lstrip())]
                            has_content = False
                            j = i + 1
                            while j < len(deduplicated_lines):
                                next_line = deduplicated_lines[j]
                                next_stripped = next_line.strip()
                                if next_stripped == "pass":
                                    has_content = True
                                    break
                                if next_stripped.startswith("class "):
                                    # Next class - current one is empty
                                    break
                                if (
                                    next_stripped
                                    and ":" in next_stripped
                                    and not next_stripped.startswith("#")
                                ):
                                    # Has a field
                                    has_content = True
                                    break
                                j += 1

                            # If class is empty (no content before next class), add pass
                            if not has_content:
                                final_lines.append(f"{class_indent}    pass")

                        i += 1

                    lines.extend(final_lines)
                else:
                    lines.extend(class_lines)
                lines.append("")

    lines.append("")
    lines.append("")
    lines.append(
        "# ============================================================================"
    )
    lines.append("# REGISTRY")
    lines.append(
        "# ============================================================================"
    )
    lines.append("")
    lines.append("_registry: dict[str, tuple[str, str, str, str]] = {")

    # Add registry entries
    # type_definitions is (sql_path, route_name, types_content, sql_params_class, sql_row_class, api_request_class, api_response_class)
    for (
        sql_path,
        _,
        _,
        sql_params_class,
        sql_row_class,
        api_request_class,
        api_response_class,
    ) in sorted(type_definitions, key=lambda x: x[0]):
        lines.append(f'    "{sql_path}": (')
        lines.append(f'        "{sql_params_class}",')
        lines.append(f'        "{sql_row_class}",')
        lines.append(f'        "{api_request_class}",')
        lines.append(f'        "{api_response_class}",')
        lines.append("    ),")

    lines.append("}")
    lines.append("")
    lines.append("")
    lines.append(
        "# ============================================================================"
    )
    lines.append("# HELPER FUNCTIONS")
    lines.append(
        "# ============================================================================"
    )
    lines.append("")
    lines.append(
        "def get_sql_types(sql_path: str) -> tuple[Type[BaseModel], Type[BaseModel]]:"
    )
    lines.append('    """Get SQL input and output types for a SQL file path.')
    lines.append("    ")
    lines.append("    Args:")
    lines.append(
        f'        sql_path: SQL file path (e.g., "app/sql/{VERSION}/agents/get_agent_new_complete.sql")'
    )
    lines.append("    ")
    lines.append("    Returns:")
    lines.append("        Tuple of (SqlParamsType, SqlRowType)")
    lines.append("    ")
    lines.append("    Raises:")
    lines.append("        ValueError: If no types are found for the SQL file path")
    lines.append('    """')
    lines.append("    if sql_path not in _registry:")
    lines.append('        raise ValueError(f"No types found for SQL path: {sql_path}")')
    lines.append("    ")
    lines.append("    sql_params_class, sql_row_class, _, _ = _registry[sql_path]")
    lines.append("    ")
    lines.append("    # Get class from current module")
    lines.append("    import sys")
    lines.append("    current_module = sys.modules[__name__]")
    lines.append("    sql_params_type = getattr(current_module, sql_params_class)")
    lines.append("    sql_row_type = getattr(current_module, sql_row_class)")
    lines.append("    ")
    lines.append("    return sql_params_type, sql_row_type")
    lines.append("")
    lines.append("")
    lines.append(
        "def get_api_types(sql_path: str) -> tuple[Type[BaseModel], Type[BaseModel]]:"
    )
    lines.append('    """Get API request and response types for a SQL file path.')
    lines.append("    ")
    lines.append("    Args:")
    lines.append(
        f'        sql_path: SQL file path (e.g., "app/sql/{VERSION}/agents/get_agent_new_complete.sql")'
    )
    lines.append("    ")
    lines.append("    Returns:")
    lines.append("        Tuple of (ApiRequestType, ApiResponseType)")
    lines.append("    ")
    lines.append("    Raises:")
    lines.append("        ValueError: If no types are found for the SQL file path")
    lines.append('    """')
    lines.append("    if sql_path not in _registry:")
    lines.append('        raise ValueError(f"No types found for SQL path: {sql_path}")')
    lines.append("    ")
    lines.append(
        "    _, _, api_request_class, api_response_class = _registry[sql_path]"
    )
    lines.append("    ")
    lines.append("    # Get class from current module")
    lines.append("    import sys")
    lines.append("    current_module = sys.modules[__name__]")
    lines.append("    api_request_type = getattr(current_module, api_request_class)")
    lines.append("    api_response_type = getattr(current_module, api_response_class)")
    lines.append("    ")
    lines.append("    return api_request_type, api_response_type")
    lines.append("")
    lines.append("")
    lines.append(
        "# Overload declarations for load_sql_query() - provides strong type hints"
    )
    lines.append("# Auto-generated by sql-compile. Do not edit manually.")
    lines.append("if TYPE_CHECKING:")

    # Generate overload declarations for load_sql_query() for each SQL file
    for (
        sql_path,
        _,
        _,
        sql_params_class,
        sql_row_class,
        api_request_class,
        api_response_class,
    ) in sorted(type_definitions, key=lambda x: x[0]):
        lines.append("    @overload")
        lines.append("    def load_sql_query(")
        lines.append(f'        file_path: Literal["{sql_path}"]')
        lines.append("    ) -> SqlString: ...")
        lines.append("")

    # Add fallback overload for any string (for runtime compatibility)
    lines.append("    @overload")
    lines.append("    def load_sql_query(")
    lines.append("        file_path: str")
    lines.append("    ) -> SqlString: ...")
    lines.append("")
    lines.append("")
    lines.append("def load_sql_query(")
    lines.append("    file_path: str,")
    lines.append(") -> SqlString:")
    lines.append('    """Load SQL file content and return as string.')
    lines.append("")
    lines.append("    Returns the SQL query string from the specified file path.")
    lines.append(
        "    Uses Literal overloads to provide strong type hints for file paths."
    )
    lines.append("")
    lines.append("    Args:")
    if registry_type == "app":
        lines.append(
            f'        file_path: Relative path from server root (e.g., "app/sql/{VERSION}/agents/get_agent_new_complete.sql")'
        )
    else:
        lines.append(
            '        file_path: Relative path from server root (e.g., "tests/sql/integration/infra/activity/insert_test_profile.sql")'
        )
    lines.append("")
    lines.append("    Returns:")
    lines.append("        SQL string with parameter placeholders ($1, $2, etc.)")
    lines.append("")
    lines.append("    Example:")
    lines.append("        ```python")
    if registry_type == "app":
        lines.append(
            f'        sql_query = load_sql_query("app/sql/{VERSION}/agents/get_agent_new_complete.sql")'
        )
    else:
        lines.append(
            '        sql_query = load_sql_query("tests/sql/integration/infra/activity/insert_test_profile.sql")'
        )
    lines.append("        # sql_query is typed as SqlString")
    lines.append("        ```")
    lines.append('    """')
    lines.append("    # Import here to avoid circular imports")
    lines.append("    from utils.sql_helper import load_sql")
    lines.append("")
    lines.append("    return load_sql(file_path)")

    types_file.write_text("\n".join(lines))


def _detect_function_in_sql(sql_text: str) -> bool:
    """Detect if SQL file contains a function definition.

    Args:
        sql_text: SQL file content

    Returns:
        True if SQL contains CREATE OR REPLACE FUNCTION
    """
    # Check for function definition pattern
    # Match CREATE OR REPLACE FUNCTION (case insensitive, multiline)
    pattern = r"CREATE\s+OR\s+REPLACE\s+FUNCTION"
    return bool(re.search(pattern, sql_text, re.IGNORECASE | re.MULTILINE))


def _detect_transaction_block(sql_text: str) -> bool:
    """Detect if SQL file contains BEGIN/COMMIT transaction blocks.

    Args:
        sql_text: SQL file content

    Returns:
        True if SQL contains BEGIN; and COMMIT; blocks
    """
    # Check for BEGIN; and COMMIT; patterns (case insensitive)
    has_begin = bool(
        re.search(r"^\s*BEGIN\s*;", sql_text, re.IGNORECASE | re.MULTILINE)
    )
    has_commit = bool(
        re.search(r"^\s*COMMIT\s*;", sql_text, re.IGNORECASE | re.MULTILINE)
    )
    return has_begin and has_commit


async def execute_sql_file(
    sql_path: str, conn: asyncpg.Connection, server_root: Path
) -> tuple[bool, str]:
    """Execute SQL file on database (for functions/types).

    Uses savepoints for SQL files with BEGIN/COMMIT blocks to prevent
    transaction corruption when one file fails.

    Args:
        sql_path: SQL file path relative to server root
        conn: Database connection
        server_root: Server root directory

    Returns:
        Tuple of (success, error_message)
    """
    try:
        # Load SQL file
        sql_text = load_sql(sql_path)

        # Check if SQL contains transaction blocks (BEGIN/COMMIT)
        has_transaction_block = _detect_transaction_block(sql_text)

        # Execute if it contains function definitions OR if it's a DDL file with transaction blocks
        # (e.g., analytics view creation which creates materialized views and indexes)
        has_function = _detect_function_in_sql(sql_text)
        if not has_function and not has_transaction_block:
            return (
                True,
                f"Skipping {sql_path} (no function definition or DDL transaction block)",
            )

        # For DDL-only files (no function), we still need to execute them
        # but they won't be introspected later (handled in generate_types_for_sql_file)

        if has_transaction_block:
            # For SQL files with BEGIN/COMMIT, we need to wrap execution in a transaction
            # and use savepoints for isolation. However, PostgreSQL doesn't support nested
            # transactions, so we strip BEGIN/COMMIT and wrap in our own transaction.
            import hashlib

            savepoint_name = f"sp_{hashlib.md5(sql_path.encode()).hexdigest()[:16]}"

            # Strip BEGIN; and COMMIT; from SQL text
            # Remove BEGIN; at the start (with optional whitespace)
            sql_without_transaction = re.sub(
                r"^\s*BEGIN\s*;\s*", "", sql_text, flags=re.IGNORECASE | re.MULTILINE
            )
            # Remove COMMIT; at the end (with optional whitespace)
            sql_without_transaction = re.sub(
                r"\s*COMMIT\s*;\s*$",
                "",
                sql_without_transaction,
                flags=re.IGNORECASE | re.MULTILINE,
            )

            try:
                # Start transaction and create savepoint
                await conn.execute("BEGIN")
                await conn.execute(f"SAVEPOINT {savepoint_name}")

                # Execute SQL file (without BEGIN/COMMIT, now wrapped in our transaction)
                await conn.execute(sql_without_transaction)

                # Release savepoint and commit on success
                await conn.execute(f"RELEASE SAVEPOINT {savepoint_name}")
                await conn.execute("COMMIT")
                return True, f"Executed {sql_path}"

            except Exception as e:
                error_str = str(e)

                # Extract line number and position from PostgreSQL error if available
                line_match = re.search(r"LINE (\d+)", error_str, re.IGNORECASE)
                line_num = line_match.group(1) if line_match else None
                position_match = re.search(r"position (\d+)", error_str, re.IGNORECASE)
                position = int(position_match.group(1)) if position_match else None

                # Extract SQL snippet around error position for better error messages
                sql_snippet = None

                # Try to extract line-based context if we have a line number
                if line_num:
                    try:
                        lines = sql_without_transaction.split("\n")
                        line_idx = int(line_num) - 1
                        if 0 <= line_idx < len(lines):
                            # Get 5 lines before and after for context
                            start = max(0, line_idx - 5)
                            end = min(len(lines), line_idx + 6)
                            context_lines = lines[start:end]
                            sql_snippet = "\n".join(
                                f"{start + i + 1:4d} | {line}"
                                if i + start != line_idx
                                else f"{start + i + 1:4d} | {line}  <-- ERROR"
                                for i, line in enumerate(context_lines)
                            )
                    except (ValueError, IndexError):
                        pass

                # Fallback to position-based extraction if line number extraction failed
                if (
                    not sql_snippet
                    and position
                    and position < len(sql_without_transaction)
                ):
                    start = max(0, position - 300)
                    end = min(len(sql_without_transaction), position + 300)
                    sql_snippet = sql_without_transaction[start:end]

                # Format error message similar to psql for better debugging
                error_parts = [f"Error executing {sql_path}"]
                if line_num:
                    error_parts.append(f"LINE {line_num}")
                if position:
                    error_parts.append(f"position {position}")
                error_parts.append(f"\n{error_str}")
                if sql_snippet:
                    error_parts.append(f"\n\nSQL context:\n{sql_snippet}")

                formatted_error = "\n".join(error_parts)

                # Rollback to savepoint on error to restore connection state
                try:
                    await conn.execute(f"ROLLBACK TO SAVEPOINT {savepoint_name}")
                    await conn.execute(
                        "COMMIT"
                    )  # Commit the outer transaction (savepoint rollback succeeded)
                except Exception as rollback_error:
                    # If rollback fails, rollback entire transaction
                    try:
                        await conn.execute("ROLLBACK")
                    except Exception:
                        pass  # Connection may be corrupted, caller will handle
                    return (
                        False,
                        f"{formatted_error}\n(rollback also failed: {str(rollback_error)})",
                    )
                return False, formatted_error
        else:
            # No transaction block, execute normally
            await conn.execute(sql_text)
            return True, f"Executed {sql_path}"

    except Exception as e:
        return False, f"Error executing {sql_path}: {str(e)}"


async def _recover_from_transaction_abort(conn: asyncpg.Connection) -> bool:
    """Recover from transaction abort by rolling back.

    Args:
        conn: Database connection

    Returns:
        True if recovery was attempted, False if connection is clean
    """
    try:
        # Try to execute a simple query to check transaction state
        await conn.execute("SELECT 1")
        return False  # Connection is clean
    except Exception as e:
        error_msg = str(e)
        if "current transaction is aborted" in error_msg.lower():
            # Transaction is aborted, rollback to clean state
            try:
                await conn.execute("ROLLBACK")
                return True  # Recovery attempted
            except Exception:
                # Rollback failed, connection is corrupted
                # This shouldn't happen with savepoints, but handle it anyway
                return False
        # Some other error, not a transaction abort
        return False


async def generate_types_for_sql_file(
    sql_path: str,
    conn: asyncpg.Connection,
    server_root: Path,
    skip_execution: bool = False,
) -> tuple[bool, str, tuple[str, str, str, str, str, str, str] | None]:
    """Generate types for a single SQL file.

    Args:
        sql_path: SQL file path relative to server root
        conn: Database connection
        server_root: Server root directory
        skip_execution: If True, skip SQL execution (already done in first pass)

    Returns:
        Tuple of (success, error_message, type_definition) where type_definition is:
        (sql_path, route_name, types_content, sql_params_class, sql_row_class, api_request_class, api_response_class)
        or None if skipped/error
    """
    try:
        # Skip introspection for DDL-only files (no function definitions)
        # These files are executed but don't need type generation
        # Exception: analytics view is legitimate DDL and should not show warning
        sql_text = load_sql(sql_path)
        if not _detect_function_in_sql(sql_text):
            # Analytics view is legitimate DDL - execute it but don't show warning
            if "analytics/create_analytics_view_complete.sql" in sql_path:
                return (
                    True,
                    f"Executed {sql_path} (materialized view - DDL only)",
                    None,
                )
            return (
                True,
                f"Skipping {sql_path} (no function definition - DDL only)",
                None,
            )

        # Introspect SQL file
        metadata = await introspect_sql_file(sql_path, conn)

        if metadata.error:
            # If function doesn't exist and this is a function SQL file, try executing it again
            # This handles cases where a function was dropped by a later SQL file during execution phase
            if (
                "does not exist in database" in metadata.error
                and _detect_function_in_sql(load_sql(sql_path))
            ):
                # Try executing the SQL file again to recreate the function
                execute_success, execute_message = await execute_sql_file(
                    sql_path, conn, server_root
                )
                if execute_success:
                    # Retry introspection
                    metadata = await introspect_sql_file(sql_path, conn)
                    if metadata.error:
                        # Still failed after re-execution
                        if sql_path.startswith("tests/sql/"):
                            return (
                                True,
                                f"Skipping {sql_path} (introspection failed: {metadata.error})",
                                None,
                            )
                        return False, metadata.error, None
                else:
                    # Re-execution failed
                    if sql_path.startswith("tests/sql/"):
                        return (
                            True,
                            f"Skipping {sql_path} (introspection failed: {metadata.error}, re-execution failed: {execute_message})",
                            None,
                        )
                    return (
                        False,
                        f"{metadata.error} (re-execution failed: {execute_message})",
                        None,
                    )
            else:
                # For test SQL files, treat introspection errors as skips (they're often mocks/seeds)
                if sql_path.startswith("tests/sql/"):
                    return (
                        True,
                        f"Skipping {sql_path} (introspection failed: {metadata.error})",
                        None,
                    )
                return False, metadata.error, None

        # Extract route name from SQL path
        route_name = _sql_path_to_route_name(sql_path)
        if not route_name:
            return True, f"Skipping {sql_path} (doesn't match route pattern)", None

        # Generate types content (pass connection for composite type introspection)
        types_content = await generate_types_file(metadata, route_name, conn)

        # Generate class names
        sql_params_class = _to_class_name(route_name, "SqlParams")
        sql_row_class = _to_class_name(route_name, "SqlRow")
        api_request_class = _to_class_name(route_name, "ApiRequest")
        api_response_class = _to_class_name(route_name, "ApiResponse")

        type_definition = (
            sql_path,
            route_name,
            types_content,
            sql_params_class,
            sql_row_class,
            api_request_class,
            api_response_class,
        )

        return True, f"Generated types for {sql_path}", type_definition

    except Exception as e:
        # For test SQL files, treat exceptions as skips (they're often mocks/seeds)
        if sql_path.startswith("tests/sql/"):
            return (
                True,
                f"Skipping {sql_path} (error during processing: {str(e)})",
                None,
            )
        return False, f"Error processing {sql_path}: {str(e)}", None


async def main() -> int:
    """Main entry point."""
    # Get database connection info from environment
    db_user = os.getenv("DB_USER", "myuser")
    db_password = os.getenv("DB_PASSWORD", "mypassword")
    db_name = os.getenv("DB_NAME", "mydb")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "5432"))

    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    # Get server root
    server_root = Path(__file__).parent.parent

    # Find all SQL files from both app and tests directories
    sql_files: list[Path] = []

    # Process app/sql/{VERSION}/
    app_sql_dir = server_root / "app" / "sql" / VERSION
    if app_sql_dir.exists():
        sql_files.extend(app_sql_dir.rglob("*.sql"))

    # Process tests/sql/{VERSION}/integration/ (all subdirectories)
    tests_sql_dir = server_root / "tests" / "sql" / VERSION / "integration"
    if tests_sql_dir.exists():
        sql_files.extend(tests_sql_dir.rglob("*.sql"))

    if not sql_files:
        print(
            f"⚠️  No SQL files found in app/sql/{VERSION}/ or tests/sql/{VERSION}/integration/"
        )
        return 0

    print(f"🔍 Found {len(sql_files)} SQL files to process")

    # Custom sorting function to prioritize analytics routes
    def _sort_sql_files(sql_file: Path) -> tuple[int, str]:
        """Sort SQL files with analytics routes first, and handle type dependencies.

        Returns:
            Tuple of (priority, path) where:
            - Priority 0: Analytics view creation file (must be first)
            - Priority 1: Other analytics routes
            - Priority 2: Settings detail (must come before active settings)
            - Priority 3: All other routes (sorted alphabetically)
        """
        sql_path = str(sql_file.relative_to(server_root))

        # Analytics view creation file must be first
        if (
            sql_path
            == f"app/sql/{VERSION}/analytics/create_analytics_view_complete.sql"
        ):
            return (0, sql_path)

        # Other analytics routes come next
        if sql_path.startswith(f"app/sql/{VERSION}/analytics/"):
            return (1, sql_path)

        # Settings detail must come before active settings (type dependency)
        if sql_path == f"app/sql/{VERSION}/settings/get_settings_detail_complete.sql":
            return (
                2,
                "a_" + sql_path,
            )  # 'a_' prefix ensures it sorts before 'get_active_'

        if sql_path == f"app/sql/{VERSION}/settings/get_active_settings_complete.sql":
            return (2, "b_" + sql_path)  # 'b_' prefix ensures it sorts after detail

        # All other routes sorted alphabetically
        return (3, sql_path)

    # Sort SQL files with analytics routes first
    sorted_sql_files = sorted(sql_files, key=_sort_sql_files)

    # Connect to database
    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        print(f"   URL: postgresql://{db_user}:***@{db_host}:{db_port}/{db_name}")
        return 1

    try:
        # Process each SQL file
        errors: list[tuple[str, str]] = []  # (sql_path, error_message)
        successes: list[str] = []
        skipped: list[str] = []
        type_definitions: list[
            tuple[str, str, str, str, str, str, str]
        ] = []  # (sql_path, route_name, types_content, sql_params_class, sql_row_class, api_request_class, api_response_class)

        # First pass: Execute all SQL files that contain functions/types
        # This ensures functions and types exist in the database before introspection
        # Analytics routes are processed first since they depend on the materialized view
        print("\n📝 Executing SQL files with functions/types...")
        print("   (Analytics routes processed first due to dependencies)")
        execution_errors: list[tuple[str, str]] = []
        failed_files: set[str] = set()  # Track files that failed during execution

        for sql_file in sorted_sql_files:
            sql_path = str(sql_file.relative_to(server_root))
            execute_success, execute_message = await execute_sql_file(
                sql_path, conn, server_root
            )

            if not execute_success:
                # Recover from transaction abort if needed
                await _recover_from_transaction_abort(conn)

                # Track failed files
                failed_files.add(sql_path)

                # For test SQL files, treat execution errors as skips
                if sql_path.startswith("tests/sql/"):
                    print(f"⏭️  {execute_message}")
                else:
                    execution_errors.append((sql_path, execute_message))
                    print(f"❌ {execute_message}")
            elif "Executed" in execute_message:
                print(f"✅ {execute_message}")

        # Ensure connection is in clean state before introspection
        await _recover_from_transaction_abort(conn)

        # Add execution errors to main errors list for accurate counting
        errors.extend(execution_errors)

        if execution_errors:
            print(f"\n⚠️  {len(execution_errors)} SQL files failed to execute:")
            for sql_path, error_msg in execution_errors:
                print(f"   - {sql_path}: {error_msg}")
            print("\n   Continuing with type generation anyway...")

        # Second pass: Generate types for all SQL files
        # Use same sorting order as execution phase
        print("\n🔍 Generating types from SQL files...")

        for sql_file in sorted_sql_files:
            # Get relative path from server root
            sql_path = str(sql_file.relative_to(server_root))

            # Skip files that failed during execution phase
            if sql_path in failed_files:
                skipped.append(sql_path)
                print(f"⏭️  Skipping {sql_path} (failed during execution phase)")
                continue

            # Recover from transaction abort if needed before each introspection
            await _recover_from_transaction_abort(conn)

            success, message, type_definition = await generate_types_for_sql_file(
                sql_path, conn, server_root, skip_execution=True
            )

            if success:
                if "Skipping" not in message:
                    successes.append(message)
                    print(f"✅ {message}")
                    # Collect type definition if available
                    if type_definition:
                        type_definitions.append(type_definition)
                else:
                    skipped.append(sql_path)
                    print(f"⏭️  {message}")
            else:
                # Recover from transaction abort after error
                await _recover_from_transaction_abort(conn)

                # Store as tuple for better grouping
                errors.append((sql_path, message))
                print(f"❌ {sql_path}: {message}")

        # Separate app and test type definitions
        app_type_definitions = [
            td for td in type_definitions if td[0].startswith(f"app/sql/{VERSION}/")
        ]
        test_type_definitions = [
            td
            for td in type_definitions
            if td[0].startswith(f"tests/sql/{VERSION}/integration/")
        ]

        # Write app consolidated types file if we have entries
        if app_type_definitions:
            write_consolidated_types_file(app_type_definitions, "app", server_root)
            print(
                f"✅ Generated app/sql/types.py with {len(app_type_definitions)} type definitions"
            )

        # Write test consolidated types file if we have entries
        if test_type_definitions:
            write_consolidated_types_file(test_type_definitions, "test", server_root)
            print(
                f"✅ Generated tests/sql/types.py with {len(test_type_definitions)} type definitions"
            )

        # Summary
        print("\n📊 Summary:")
        print(f"   ✅ Generated: {len(successes)}")
        print(f"   ⏭️  Skipped: {len(skipped)}")
        print(f"   ❌ Errors: {len(errors)}")

        if errors:
            # Group errors by error message to identify patterns
            error_groups: dict[str, list[str]] = {}
            for sql_path, error_msg in errors:
                # Extract the core error (remove file-specific details)
                # Common patterns: function doesn't exist, relation doesn't exist, syntax error
                core_error = error_msg
                # Normalize error messages for grouping
                if "does not exist" in error_msg:
                    # Extract the object name (function, relation, column)
                    if "function" in error_msg:
                        # Extract function name
                        match = re.search(
                            r"function (\w+)\([^)]+\) does not exist", error_msg
                        )
                        if match:
                            core_error = f"function {match.group(1)} does not exist"
                    elif "relation" in error_msg:
                        match = re.search(
                            r'relation "([^"]+)" does not exist', error_msg
                        )
                        if match:
                            core_error = f'relation "{match.group(1)}" does not exist'
                    elif "column" in error_msg:
                        match = re.search(
                            r'column "([^"]+)" (?:of relation "[^"]+" )?does not exist',
                            error_msg,
                        )
                        if match:
                            core_error = f'column "{match.group(1)}" does not exist'
                elif "syntax error" in error_msg:
                    # Extract the location of syntax error
                    match = re.search(r'syntax error at or near "([^"]+)"', error_msg)
                    if match:
                        core_error = f'syntax error at or near "{match.group(1)}"'
                elif "cannot insert multiple commands" in error_msg:
                    core_error = (
                        "cannot insert multiple commands into a prepared statement"
                    )
                elif "could not determine data type" in error_msg:
                    core_error = "could not determine data type of parameter"

                if core_error not in error_groups:
                    error_groups[core_error] = []
                error_groups[core_error].append(sql_path)

            # Sort error groups by count (most common first)
            sorted_groups = sorted(
                error_groups.items(), key=lambda x: len(x[1]), reverse=True
            )

            print("\n❌ SQL compilation failed. Errors grouped by type:")
            print()

            for core_error, files in sorted_groups:
                count = len(files)
                print(f"   {core_error} ({count} file{'s' if count > 1 else ''}):")
                # Show all files for this error type
                for file_path in sorted(files):
                    print(f"      - {file_path}")
                print()

            return 1

        print("\n✅ SQL compilation complete!")
        return 0

    finally:
        await conn.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
