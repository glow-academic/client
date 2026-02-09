"""SQL type compilation infrastructure.

Provides compile_sql_types() function that can be called programmatically
from both the Makefile script and the /init endpoint.

All helper functions are inlined here to avoid dependencies on scripts folder
at runtime in production.
"""

import os
import re
import sys
from pathlib import Path

import asyncpg  # type: ignore

# Version constant - change this to switch versions (e.g., 'v4', 'v5')
VERSION = "v4"

# Import utilities that are available in app folder
from app.utils.sql_helper import load_sql


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

    Handles paths of arbitrary depth:
        f"app/sql/{VERSION}/queries/agents/create_agent_complete.sql" -> "create_agent"
        f"app/sql/{VERSION}/queries/documents/tools/html/document_tool_html_complete_complete.sql" -> "document_tool_html_complete"
        f"tests/sql/{VERSION}/integration/queries/infra/activity/insert_test_profile.sql" -> "insert_test_profile"

    Args:
        sql_path: SQL file path relative to server root

    Returns:
        Route name or None if pattern doesn't match
    """
    app_sql_prefix = f"app/sql/{VERSION}/queries/"
    tests_sql_prefix = f"tests/sql/{VERSION}/integration/queries/"

    # Pattern: app/sql/{VERSION}/queries/[resource]/[operation]_complete.sql
    # Pattern: app/sql/{VERSION}/queries/infrastructure/infrastructure_[category]_[operation]_complete.sql -> infra_[category]_[operation]
    # Pattern: app/sql/{VERSION}/queries/[any]/[path]/[operation]_complete.sql (arbitrary depth)
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

        # Handle arbitrary depth paths: [any]/[path]/[operation]_complete.sql
        # Extract filename (last part) and use it as the operation name
        if len(parts) < 2:
            return None

        filename = parts[-1]
        if not filename.endswith("_complete.sql"):
            return None

        # Extract operation name from filename (remove _complete.sql suffix)
        operation = filename[: -len("_complete.sql")]

        return operation.replace("-", "_")

    # Pattern: tests/sql/{VERSION}/integration/queries/infra/[resource]/[operation].sql
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

    # Pattern: tests/sql/{VERSION}/integration/queries/socket/[operation].sql (allow nested folders)
    if sql_path.startswith(f"{tests_sql_prefix}socket/"):
        relative = sql_path[len(f"{tests_sql_prefix}socket/") :]
        if not relative.endswith(".sql"):
            return None
        operation = Path(relative).stem
        return operation.replace("-", "_")

    # Pattern: tests/sql/{VERSION}/integration/queries/api/[resource]/test_[operation]_v4_complete.sql
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

    # Pattern: tests/sql/{VERSION}/integration/queries/helpers/test_[operation]_v4_complete.sql
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

    # Pattern: tests/sql/{VERSION}/integration/queries/conftest/test_[operation]_v4_complete.sql
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


def _build_view_dependency_order(
    sql_files: list[Path], server_root: Path
) -> dict[str, int]:
    """Auto-detect view/MV dependencies and return execution order levels.

    Parses SQL files to find CREATE VIEW / CREATE MATERIALIZED VIEW statements,
    then detects cross-file references and computes a topological ordering.

    Args:
        sql_files: List of all SQL file paths
        server_root: Server root directory

    Returns:
        Dict mapping relative sql_path -> level (0 = no view deps, higher = later)
    """
    view_prefix = f"app/sql/{VERSION}/views/"

    # Filter to view files only
    view_files: list[tuple[str, Path]] = []
    for f in sql_files:
        rel = str(f.relative_to(server_root))
        if rel.startswith(view_prefix):
            view_files.append((rel, f))

    # Pass 1: parse CREATE statements to build object_name -> sql_path map
    create_re = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)",
        re.IGNORECASE,
    )
    # object_name -> set of sql_paths that create it
    name_to_file: dict[str, str] = {}
    # sql_path -> set of object names it creates
    file_creates: dict[str, set[str]] = {}
    # sql_path -> full SQL text (cached for pass 2)
    file_sql: dict[str, str] = {}

    for rel_path, full_path in view_files:
        try:
            sql_text = full_path.read_text()
        except Exception:
            continue
        file_sql[rel_path] = sql_text
        creates: set[str] = set()
        for m in create_re.finditer(sql_text):
            obj_name = m.group(1).lower()
            creates.add(obj_name)
            name_to_file[obj_name] = rel_path
        file_creates[rel_path] = creates

    # Pass 2: detect cross-file dependencies via word-boundary matching
    # For each file, check which other files' created objects appear in its SQL
    # deps: sql_path -> set of sql_paths it depends on
    deps: dict[str, set[str]] = {}
    all_names = list(name_to_file.keys())

    for rel_path in file_sql:
        sql_text = file_sql[rel_path].lower()
        own_names = file_creates.get(rel_path, set())
        file_deps: set[str] = set()
        for obj_name in all_names:
            # Skip self-references (same file creates and references it, e.g. DROP then CREATE)
            if obj_name in own_names:
                continue
            # Word-boundary check to avoid false matches on substrings
            if re.search(r"\b" + re.escape(obj_name) + r"\b", sql_text):
                dep_file = name_to_file[obj_name]
                if dep_file != rel_path:
                    file_deps.add(dep_file)
        deps[rel_path] = file_deps

    # Topological sort: compute levels
    levels: dict[str, int] = {}
    computing: set[str] = set()  # cycle detection

    def _compute_level(path: str) -> int:
        if path in levels:
            return levels[path]
        if path in computing:
            # Cycle detected — treat as level 0
            levels[path] = 0
            return 0
        computing.add(path)
        dep_paths = deps.get(path, set())
        if not dep_paths:
            level = 0
        else:
            level = max(_compute_level(d) for d in dep_paths) + 1
        levels[path] = level
        computing.discard(path)
        return level

    for rel_path, _ in view_files:
        _compute_level(rel_path)

    return levels


def _sort_sql_files(
    sql_file: Path, server_root: Path, view_order: dict[str, int] | None = None
) -> tuple[int, str]:
    """Sort SQL files with proper dependency ordering for views and MVs.

    Args:
        sql_file: Path to SQL file
        server_root: Server root directory
        view_order: Auto-detected view dependency levels from _build_view_dependency_order()

    Returns:
        Tuple of (priority, path) for sorting where lower priority = earlier execution.

    View/MV Dependency Ordering (auto-detected):
        Levels are computed by _build_view_dependency_order() via topological sort.
        Level 0 = no view/MV dependencies, Level N = depends on Level N-1.

    Query Ordering:
        Priority 10: Analytics queries
        Priority 11: Analytics-dependent queries (dashboard, reports, etc.)
        Priority 12: Settings detail (before active settings due to type dependency)
        Priority 13: Active settings
        Priority 20: All other queries
    """
    sql_path = str(sql_file.relative_to(server_root))

    # Handle views/ directory — use auto-detected dependency levels
    if sql_path.startswith(f"app/sql/{VERSION}/views/"):
        level = (view_order or {}).get(sql_path, 0)
        return (level, sql_path)

    # Other analytics routes come next
    if sql_path.startswith(f"app/sql/{VERSION}/queries/analytics/"):
        return (10, sql_path)

    # Files that depend on analytics view must come after analytics
    analytics_dependent_paths = [
        f"app/sql/{VERSION}/queries/dashboard/get_dashboard_bundle_complete.sql",
        f"app/sql/{VERSION}/queries/documents/get_certificate_data_complete.sql",
        f"app/sql/{VERSION}/queries/home/get_home_overview_complete.sql",
        f"app/sql/{VERSION}/queries/leaderboard/get_leaderboard_bundle_complete.sql",
        f"app/sql/{VERSION}/queries/practice/get_practice_overview_complete.sql",
        f"app/sql/{VERSION}/queries/reports/get_per_simulation_metrics_complete.sql",
        f"app/sql/{VERSION}/queries/reports/get_reports_bundle_complete.sql",
        f"app/sql/{VERSION}/queries/reports/get_reports_overview_complete.sql",
    ]
    if sql_path in analytics_dependent_paths:
        return (11, sql_path)

    # Settings detail must come before active settings (type dependency)
    if (
        sql_path
        == f"app/sql/{VERSION}/queries/settings/get_settings_detail_complete.sql"
    ):
        return (
            12,
            "a_" + sql_path,
        )  # 'a_' prefix ensures it sorts before 'get_active_'

    if (
        sql_path
        == f"app/sql/{VERSION}/queries/settings/get_active_settings_complete.sql"
    ):
        return (13, "b_" + sql_path)  # 'b_' prefix ensures it sorts after detail

    # Profile: get_profile_complete creates types.q_get_profile_v4_role_resource
    # that get_profile_access_complete depends on — must execute first
    if sql_path == f"app/sql/{VERSION}/queries/profile/get_profile_complete.sql":
        return (14, sql_path)

    if sql_path == f"app/sql/{VERSION}/queries/profile/get_profile_access_complete.sql":
        return (15, sql_path)

    # All other routes sorted alphabetically
    return (20, sql_path)


async def execute_sql_file(
    sql_path: str, conn: asyncpg.Connection, server_root: Path
) -> tuple[bool, str]:
    """Execute SQL file on database (for functions/types).

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

        # Check if it contains function definitions
        has_function = _detect_function_in_sql(sql_text)

        # Always execute files in the views/ directory (DDL only, no function)
        # Views must be executed before other files that depend on them
        is_view_file = sql_path.startswith(f"app/sql/{VERSION}/views/")

        # Execute if it contains function definitions OR is a view file
        if not has_function and not is_view_file:
            return (
                True,
                f"Skipping {sql_path} (no function definition)",
            )

        # Execute SQL file directly (no BEGIN/COMMIT blocks to strip)
        await conn.execute(sql_text)
        return True, f"Executed {sql_path}"

    except Exception as e:
        return False, f"Error executing {sql_path}: {str(e)}"


def parse_existing_types_file(
    registry_type: str, server_root: Path
) -> dict[str, tuple[str, str, str, str, str, str, str]]:
    """Parse existing types.py file to extract type definitions.

    Args:
        registry_type: Either "app" or "test"
        server_root: Server root directory

    Returns:
        Dict mapping sql_path -> (sql_path, route_name, types_content, sql_params_class, sql_row_class, api_request_class, api_response_class)
    """
    if registry_type == "app":
        types_file = server_root / "app" / "sql" / "types.py"
    else:
        types_file = server_root / "tests" / "sql" / "types.py"

    if not types_file.exists():
        return {}

    content = types_file.read_text()
    result: dict[str, tuple[str, str, str, str, str, str, str]] = {}

    # Find registry section to extract class names
    registry_match = re.search(
        r"_registry:\s*dict\[str,\s*tuple\[str,\s*str,\s*str,\s*str\]\]\s*=\s*\{([^}]+)\}",
        content,
        re.DOTALL,
    )
    registry_dict: dict[str, tuple[str, str, str, str]] = {}
    if registry_match:
        registry_content = registry_match.group(1)
        # Parse registry entries: "path": ("class1", "class2", "class3", "class4")
        for match in re.finditer(
            r'"([^"]+)":\s*\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\s*\)',
            registry_content,
        ):
            sql_path = match.group(1)
            sql_params_class = match.group(2)
            sql_row_class = match.group(3)
            api_request_class = match.group(4)
            api_response_class = match.group(5)
            registry_dict[sql_path] = (
                sql_params_class,
                sql_row_class,
                api_request_class,
                api_response_class,
            )

    # Find TYPE DEFINITIONS section
    type_defs_match = re.search(
        r"# ============================================================================\s*# TYPE DEFINITIONS\s*# ============================================================================\s*(.*?)\s*# ============================================================================\s*# REGISTRY",
        content,
        re.DOTALL,
    )

    if not type_defs_match:
        return result

    type_defs_content = type_defs_match.group(1)

    # Find all "# Generated from: {route_name or sql_path}" comments
    # The comment might contain either the route name or the full sql_path
    pattern = r"# Generated from:\s*([^\n]+)\n(.*?)(?=\n# Generated from:|\n# ============================================================================|$)"
    matches = re.finditer(pattern, type_defs_content, re.DOTALL)

    for match in matches:
        comment_value = match.group(1).strip()
        types_content = match.group(2).strip()

        # Determine if comment_value is a route name or sql_path
        # Check if it looks like a path (contains slashes)
        if "/" in comment_value:
            sql_path = comment_value
            route_name = _sql_path_to_route_name(sql_path)
        else:
            # It's a route name, need to find the corresponding sql_path from registry
            route_name = comment_value
            sql_path = None
            # Find sql_path by matching route_name
            for reg_path in registry_dict.keys():
                if _sql_path_to_route_name(reg_path) == route_name:
                    sql_path = reg_path
                    break

        if not sql_path or not route_name:
            continue

        # Get class names from registry
        if sql_path not in registry_dict:
            continue

        (
            sql_params_class,
            sql_row_class,
            api_request_class,
            api_response_class,
        ) = registry_dict[sql_path]

        result[sql_path] = (
            sql_path,
            route_name,
            types_content,
            sql_params_class,
            sql_row_class,
            api_request_class,
            api_response_class,
        )

    return result


def is_types_file_complete(
    server_root: Path,
    existing_app_types: dict[str, tuple[str, str, str, str, str, str, str]],
    existing_test_types: dict[str, tuple[str, str, str, str, str, str, str]],
) -> bool:
    """Check if types.py file is complete by comparing registry size to actual SQL files.

    Returns True if types.py appears complete, False if it needs full recompilation.

    Args:
        server_root: Server root directory
        existing_app_types: Dictionary of existing app types from types.py
        existing_test_types: Dictionary of existing test types from types.py

    Returns:
        True if types.py appears complete, False if it needs full recompilation
    """
    # Count SQL files that should be processed
    app_sql_dir = server_root / "app" / "sql" / VERSION
    test_sql_dir = server_root / "tests" / "sql" / VERSION / "integration"

    expected_app_count = (
        len(list(app_sql_dir.rglob("*.sql"))) if app_sql_dir.exists() else 0
    )
    expected_test_count = (
        len(list(test_sql_dir.rglob("*.sql"))) if test_sql_dir.exists() else 0
    )

    actual_app_count = len(existing_app_types)
    actual_test_count = len(existing_test_types)

    # If we have less than 50% of expected types, consider it incomplete
    # This handles cases where compilation failed partway through
    app_complete = expected_app_count == 0 or (
        actual_app_count >= expected_app_count * 0.5
    )
    test_complete = expected_test_count == 0 or (
        actual_test_count >= expected_test_count * 0.5
    )

    return app_complete and test_complete


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

    # Scan type definitions for imports and type usage
    needs_date_import = False
    needs_time_import = False
    needs_timedelta_import = False
    for _, _, types_content, _, _, _, _ in type_definitions:
        # Check for date/time type usage in the content
        if ": date" in types_content or "list[date]" in types_content:
            needs_date_import = True
        if ": time" in types_content or "list[time]" in types_content:
            needs_time_import = True
        if ": timedelta" in types_content or "list[timedelta]" in types_content:
            needs_timedelta_import = True
        for line in types_content.split("\n"):
            if line.startswith("from typing import"):
                all_imports.add(line)
            elif line.startswith("from uuid import"):
                all_imports.add(line)
            # Skip datetime imports from content - we'll build a consolidated one
            elif line.startswith("from pydantic import"):
                # Merge pydantic imports
                if "Field" in line:
                    all_imports.add("from pydantic import Field")

    # Build consolidated datetime import with all needed types
    datetime_types = ["datetime"]
    if needs_date_import:
        datetime_types.append("date")
    if needs_time_import:
        datetime_types.append("time")
    if needs_timedelta_import:
        datetime_types.append("timedelta")
    all_imports.add(f"from datetime import {', '.join(sorted(datetime_types))}")

    # Sort imports
    datetime_imports = sorted(
        [imp for imp in all_imports if imp.startswith("from datetime")]
    )
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
    if datetime_imports:
        for imp in datetime_imports:
            lines.append(imp)
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
    lines.append("# Runtime fallback for missing generated types.")
    lines.append(
        "# This keeps server startup resilient when incremental SQL compilation misses some files."
    )
    lines.append("_missing_type_cache: dict[str, type[BaseModel]] = {}")
    lines.append("")
    lines.append("def _build_missing_type(name: str) -> type[BaseModel]:")
    lines.append(
        '    """Build a permissive placeholder model for missing generated types."""'
    )
    lines.append("    class _MissingSqlType(BaseModel):")
    lines.append('        model_config = {"extra": "allow"}')
    lines.append("")
    lines.append("        def to_tuple(self) -> tuple[Any, ...]:")
    lines.append("            return tuple(self.model_dump().values())")
    lines.append("")
    lines.append("    _MissingSqlType.__name__ = name")
    lines.append("    return _MissingSqlType")
    lines.append("")
    lines.append("def __getattr__(name: str) -> Any:")
    lines.append(
        '    """Resolve missing generated classes at import-time with placeholders."""'
    )
    lines.append("    if not (")
    lines.append(
        '        name.endswith(("SqlParams", "SqlRow", "ApiRequest", "ApiResponse"))'
    )
    lines.append('        or name.startswith("Q")')
    lines.append("    ):")
    lines.append(
        '        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")'
    )
    lines.append("")
    lines.append("    cached = _missing_type_cache.get(name)")
    lines.append("    if cached is None:")
    lines.append("        cached = _build_missing_type(name)")
    lines.append("        _missing_type_cache[name] = cached")
    lines.append("    return cached")
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
        f'        sql_path: SQL file path (e.g., "app/sql/{VERSION}/queries/agents/get_agent_new_complete.sql")'
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
        f'        sql_path: SQL file path (e.g., "app/sql/{VERSION}/queries/agents/get_agent_new_complete.sql")'
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
            f'        file_path: Relative path from server root (e.g., "app/sql/{VERSION}/queries/agents/get_agent_new_complete.sql")'
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
            f'        sql_query = load_sql_query("app/sql/{VERSION}/queries/agents/get_agent_new_complete.sql")'
        )
    else:
        lines.append(
            '        sql_query = load_sql_query("tests/sql/integration/infra/activity/insert_test_profile.sql")'
        )
    lines.append("        # sql_query is typed as SqlString")
    lines.append("        ```")
    lines.append('    """')
    lines.append("    # Import here to avoid circular imports")
    lines.append("    from app.utils.sql_helper import load_sql")
    lines.append("")
    lines.append("    return load_sql(file_path)")

    types_file.write_text("\n".join(lines))


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
        # Import introspection functions lazily (they're in scripts folder)
        # Ensure server root is in path for imports
        server_root_str = str(server_root)
        if server_root_str not in sys.path:
            sys.path.insert(0, server_root_str)

        # Import introspection functions from app folder (available at runtime)
        from app.infra.v4.sql.sql_introspect import introspect_sql_file
        from app.infra.v4.sql.sql_typegen import generate_types_file

        # Skip introspection for DDL-only files (no function definitions)
        # These files are executed but don't need type generation
        # Files in views/ are legitimate DDL and should not show warning
        sql_text = load_sql(sql_path)
        if not _detect_function_in_sql(sql_text):
            # View files are legitimate DDL - execute them but don't show warning
            if sql_path.startswith(f"app/sql/{VERSION}/views/"):
                return (
                    True,
                    f"Executed {sql_path} (view DDL only)",
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


async def compile_sql_types(
    sql_files: list[str] | None = None,
    db_user: str | None = None,
    db_password: str | None = None,
    db_name: str | None = None,
    db_host: str | None = None,
    db_port: int | None = None,
    server_root: Path | None = None,
) -> tuple[bool, str]:
    """Compile SQL files and generate types.

    This is the core function that can be called programmatically from both
    the Makefile script and the /init endpoint.

    Args:
        sql_files: Optional list of specific SQL files to process (relative to server root).
                   If None, processes all files.
        db_user: Database user (defaults to DB_USER env var or "myuser")
        db_password: Database password (defaults to DB_PASSWORD env var or "mypassword")
        db_name: Database name (defaults to DB_NAME env var or "mydb")
        db_host: Database host (defaults to DB_HOST env var or "localhost")
        db_port: Database port (defaults to DB_PORT env var or 5432)
        server_root: Server root directory (defaults to parent of app directory)

    Returns:
        Tuple of (success, message) where success is True if compilation succeeded
    """
    # Get server root
    if server_root is None:
        # Default to parent of app directory (server root)
        # compile_types.py is at: server/app/infra/v4/sql/compile_types.py
        # We need to go up 5 levels: sql -> v4 -> infra -> app -> server
        server_root = Path(__file__).resolve().parent.parent.parent.parent.parent

    # Ensure server root is in path for imports (needed when called from script)
    server_root_str = str(server_root)
    if server_root_str not in sys.path:
        sys.path.insert(0, server_root_str)

    # Get database connection info from environment or parameters
    db_user = db_user or os.getenv("DB_USER", "myuser")
    db_password = db_password or os.getenv("DB_PASSWORD", "mypassword")
    db_name = db_name or os.getenv("DB_NAME", "mydb")
    db_host = db_host or os.getenv("DB_HOST", "localhost")
    db_port = db_port or int(os.getenv("DB_PORT", "5432"))

    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    # Detect if we're in production (skip introspection)
    # In production, we only execute SQL files, don't generate types.py
    origin = os.getenv("ORIGIN", "http://localhost")
    is_production = "localhost" not in origin.lower()
    skip_introspection = is_production

    # Determine if we're in incremental mode
    incremental_mode = sql_files is not None and len(sql_files) > 0

    # Find all SQL files from both app and tests directories
    sql_file_paths: list[Path] = []

    if incremental_mode:
        # In incremental mode, only process specified files
        for file_path_str in sql_files or []:
            # Convert to Path and resolve relative to server root
            file_path = Path(file_path_str)
            if not file_path.is_absolute():
                file_path = server_root / file_path

            # Validate file exists
            if not file_path.exists():
                print(f"⚠️  File not found: {file_path}")
                continue

            # Validate file is within allowed directories
            try:
                rel_path = file_path.relative_to(server_root)
                rel_str = str(rel_path)
                if not (
                    rel_str.startswith(f"app/sql/{VERSION}/")
                    or rel_str.startswith(f"tests/sql/{VERSION}/integration/")
                ):
                    print(
                        f"⚠️  File must be in app/sql/{VERSION}/ or tests/sql/{VERSION}/integration/: {rel_str}"
                    )
                    continue
            except ValueError:
                print(f"⚠️  File must be relative to server root: {file_path}")
                continue

            sql_file_paths.append(file_path)

        if not sql_file_paths:
            return False, "No valid SQL files provided"

        print(f"🔍 Processing {len(sql_file_paths)} SQL file(s) in incremental mode")
    else:
        # Full mode: process all files
        # Process app/sql/{VERSION}/
        app_sql_dir = server_root / "app" / "sql" / VERSION
        if app_sql_dir.exists():
            sql_file_paths.extend(app_sql_dir.rglob("*.sql"))

        # Process tests/sql/{VERSION}/integration/ (all subdirectories)
        tests_sql_dir = server_root / "tests" / "sql" / VERSION / "integration"
        if tests_sql_dir.exists():
            sql_file_paths.extend(tests_sql_dir.rglob("*.sql"))

        # TEMPORARY: Exclude views/NEW/ directory (work in progress MVs)
        # TODO: Remove this exclusion once the NEW MVs are ready
        sql_file_paths = [f for f in sql_file_paths if "/views/NEW/" not in str(f)]

        if not sql_file_paths:
            return (
                True,
                f"No SQL files found in app/sql/{VERSION}/ or tests/sql/{VERSION}/integration/",
            )

        print(f"🔍 Found {len(sql_file_paths)} SQL files to process")

    # Auto-detect view dependency order, then sort
    view_order = _build_view_dependency_order(sql_file_paths, server_root)
    sorted_sql_files = sorted(
        sql_file_paths, key=lambda f: _sort_sql_files(f, server_root, view_order)
    )

    # Connect to database
    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        error_msg = f"Failed to connect to database: {e}"
        print(f"❌ {error_msg}")
        print(f"   URL: postgresql://{db_user}:***@{db_host}:{db_port}/{db_name}")
        return False, error_msg

    try:
        # Load existing type definitions for fallback preservation (both incremental and full mode)
        existing_app_types: dict[str, tuple[str, str, str, str, str, str, str]] = {}
        existing_test_types: dict[str, tuple[str, str, str, str, str, str, str]] = {}

        # Load existing types even in full mode for fallback when files fail
        existing_app_types = parse_existing_types_file("app", server_root)
        existing_test_types = parse_existing_types_file("test", server_root)

        if incremental_mode:
            print(
                f"📚 Loaded {len(existing_app_types)} existing app types and {len(existing_test_types)} existing test types"
            )

            # Check if types.py is complete - if not, fall back to full compilation
            if not is_types_file_complete(
                server_root, existing_app_types, existing_test_types
            ):
                print(
                    f"\n⚠️  types.py appears incomplete (found {len(existing_app_types)} app types, expected many more)"
                )
                print(
                    "   Falling back to full compilation to ensure all types are available..."
                )
                print("   This may take a moment...\n")
                # Switch to full mode by clearing sql_files and re-finding all files
                sql_file_paths = []
                incremental_mode = False
                # Re-find all SQL files (full mode logic)
                app_sql_dir = server_root / "app" / "sql" / VERSION
                if app_sql_dir.exists():
                    sql_file_paths.extend(app_sql_dir.rglob("*.sql"))
                tests_sql_dir = server_root / "tests" / "sql" / VERSION / "integration"
                if tests_sql_dir.exists():
                    sql_file_paths.extend(tests_sql_dir.rglob("*.sql"))
                # TEMPORARY: Exclude views/NEW/ directory (work in progress MVs)
                sql_file_paths = [
                    f for f in sql_file_paths if "/views/NEW/" not in str(f)
                ]
                if not sql_file_paths:
                    return (
                        True,
                        f"No SQL files found in app/sql/{VERSION}/ or tests/sql/{VERSION}/integration/",
                    )
                # Re-sort SQL files with auto-detected view dependency order
                view_order = _build_view_dependency_order(sql_file_paths, server_root)
                sorted_sql_files = sorted(
                    sql_file_paths,
                    key=lambda f: _sort_sql_files(f, server_root, view_order),
                )
                print(
                    f"🔍 Found {len(sql_file_paths)} SQL files to process (full compilation mode)"
                )

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
                pass  # Success - no logging needed

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
        # Skip in production - only execute SQL files, don't generate types.py
        if skip_introspection:
            print(
                "\n⏭️  Skipping type generation (production mode - ORIGIN doesn't contain localhost)"
            )
            executed_count = (
                len(sorted_sql_files) - len(failed_files) - len(execution_errors)
            )
            print(f"   ✅ Executed {executed_count} SQL files successfully")
            if execution_errors:
                print(f"   ⚠️  {len(execution_errors)} files had errors")
            return (
                True,
                f"SQL execution completed successfully ({executed_count} files executed, type generation skipped in production)",
            )

        # Use same sorting order as execution phase
        print("\n🔍 Generating types from SQL files...")

        for sql_file in sorted_sql_files:
            # Get relative path from server root
            sql_path = str(sql_file.relative_to(server_root))

            # Skip files that failed during execution phase
            if sql_path in failed_files:
                skipped.append(sql_path)
                print(f"⏭️  Skipping {sql_path} (failed during execution phase)")

                # Preserve existing types if available
                existing_type = None
                if sql_path in existing_app_types:
                    existing_type = existing_app_types[sql_path]
                elif sql_path in existing_test_types:
                    existing_type = existing_test_types[sql_path]

                if existing_type:
                    print(
                        f"   Preserving existing type definitions for {sql_path} due to compilation failure"
                    )
                    type_definitions.append(existing_type)
                continue

            # Recover from transaction abort if needed before each introspection
            await _recover_from_transaction_abort(conn)

            # Check if we have existing types for this file (for fallback preservation)
            existing_type = None
            if sql_path in existing_app_types:
                existing_type = existing_app_types[sql_path]
            elif sql_path in existing_test_types:
                existing_type = existing_test_types[sql_path]

            success, message, type_definition = await generate_types_for_sql_file(
                sql_path, conn, server_root, skip_execution=True
            )

            if success:
                if "Skipping" not in message:
                    successes.append(message)
                    # Success - no logging needed
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

                # Preserve existing types if available (works in both incremental and full mode)
                if existing_type:
                    print(
                        f"   Preserving existing type definitions for {sql_path} due to error"
                    )
                    type_definitions.append(existing_type)

        # Separate app and test type definitions
        app_type_definitions = [
            td for td in type_definitions if td[0].startswith(f"app/sql/{VERSION}/")
        ]
        test_type_definitions = [
            td
            for td in type_definitions
            if td[0].startswith(f"tests/sql/{VERSION}/integration/")
        ]

        # In incremental mode, merge with existing types for files not processed
        if incremental_mode:
            # Create set of processed SQL paths
            processed_paths = {td[0] for td in type_definitions}

            # Add existing app types that weren't processed
            for sql_path, existing_td in existing_app_types.items():
                if sql_path not in processed_paths:
                    app_type_definitions.append(existing_td)

            # Add existing test types that weren't processed
            for sql_path, existing_td in existing_test_types.items():
                if sql_path not in processed_paths:
                    test_type_definitions.append(existing_td)

            # Sort to maintain consistent order
            app_type_definitions.sort(key=lambda x: x[0])
            test_type_definitions.sort(key=lambda x: x[0])

        # Write app consolidated types file if we have entries
        # Skip in production - types.py is pre-generated and committed
        if not skip_introspection and app_type_definitions:
            write_consolidated_types_file(app_type_definitions, "app", server_root)
            # Success - no logging needed

        # Write test consolidated types file if we have entries
        # Skip in production - types.py is pre-generated and committed
        if not skip_introspection and test_type_definitions:
            write_consolidated_types_file(test_type_definitions, "test", server_root)
            # Success - no logging needed

        # Summary
        print("\n📊 Summary:")
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

            return False, f"SQL compilation failed with {len(errors)} error(s)"

        return (
            True,
            f"SQL compilation completed successfully ({len(successes)} files processed)",
        )

    finally:
        await conn.close()
