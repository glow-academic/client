"""SQL helper utility - DHH-style SQL file loading.

Routes have full control over transaction and execution.
This follows DHH principles - route owns the execution.

This module implements the agents-style architecture pattern:
- PostgreSQL functions with RETURNS TABLE instead of raw SQL queries
- Auto-detection of functions via `execute_sql_typed()` helper
- Automatic type conversion from PostgreSQL types to Pydantic models
- Support for composite types in the `types` schema

See:
- `server/app/api/v3/STANDARDS.md` for API endpoint standards
- `server/app/socket/v3/STANDARDS.md` for WebSocket endpoint standards
- `AGENTS.md` for overall architecture principles
"""

from pathlib import Path
from typing import Any, Protocol

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.sql_nest import nest

# Cache for SQL metadata introspection to avoid repeated PREPARE calls
# Type: dict[str, SQLMetadata | None]
_metadata_cache: dict[str, Any] = {}

# Track which functions have been JIT-created on this process to avoid
# redundant DROP TYPE / CREATE TYPE on every request (which causes race
# conditions under concurrent load).
_jit_created_functions: set[str] = {}


class HasToTuple(Protocol):
    """Protocol for parameter models that have to_tuple() method."""

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order."""
        ...


def load_sql(file_path: str) -> str:
    """Load SQL file content and return as string.

    Routes have full control over transaction and execution.
    This follows DHH principles - route owns the execution.

    Supports both app/sql/ and tests/sql/ paths.

    Args:
        file_path: Relative path from server root (e.g., "app/sql/v3/profile/get_profile.sql" or "tests/sql/integration/infra/activity/insert_test_profile.sql")

    Returns:
        SQL string with parameter placeholders ($1, $2, etc.)
    """
    import os

    # In Docker: PYTHONPATH=/app, so resolve relative to /app
    # Locally: resolve relative to server root (3 levels up from utils/)
    if os.getenv("PYTHONPATH") == "/app" or os.getenv("DOCKER_ENV") == "1":
        sql_path = Path("/app") / file_path
    else:
        # Local development: go up 3 levels from utils/ to server root
        sql_path = Path(__file__).parent.parent.parent / file_path

    return sql_path.read_text()


def _detect_function_in_sql(sql_text: str) -> tuple[bool, str | None, str | None]:
    """Detect if SQL contains a CREATE OR REPLACE FUNCTION and extract name/schema.

    Args:
        sql_text: SQL query text

    Returns:
        Tuple of (is_function, function_name, schema_name)
    """
    import re

    # Pattern: CREATE OR REPLACE FUNCTION [schema.]function_name
    pattern = r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:(\w+)\.)?(\w+)\s*\("
    match = re.search(pattern, sql_text, re.IGNORECASE)

    if match:
        schema = match.group(1) or "public"
        func_name = match.group(2)
        return True, func_name, schema

    return False, None, None


async def execute_sql_typed(
    conn: asyncpg.Connection,
    sql_path: str,
    params: HasToTuple | None = None,
    multi_row: bool = False,
) -> BaseModel | list[BaseModel]:
    """Execute SQL query with typed parameters and return typed result.

    Loads SQL with types, executes query, applies nest, and returns
    typed OutputType instance. This provides a convenient wrapper for
    the common pattern of: get_sql_types -> fetch -> nest -> parse.

    Automatically detects if SQL file contains a function definition and calls it.
    If it's a function, extracts the function name and calls it with SELECT * FROM function_name($1, $2, ...).
    If it's raw SQL, executes it directly.

    Everything is auto-detected from column naming convention - no configuration needed.

    Args:
        conn: Database connection
        sql_path: Relative path from server root (e.g., "app/sql/v3/agents/get_agent_new_complete.sql")
        params: Optional Pydantic model instance with parameters (e.g., GetAgentNewSqlParams)

    Returns:
        Typed result matching the SQL output type (e.g., GetAgentNewSqlRow)

    Example:
        ```python
        from app.sql.types import GetAgentNewSqlParams, GetAgentNewSqlRow
        from typing import cast

        params = GetAgentNewSqlParams(profile_id="...")
        result = cast(
            GetAgentNewSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v3/agents/get_agent_new_complete.sql",
                params=params,
                # Everything auto-detected - works for both functions and raw SQL!
            )
        )
        # result is typed as GetAgentNewSqlRow
        ```
    """
    # Import here to avoid circular imports

    from app.sql.types import get_sql_types, load_sql_query

    # Load SQL file to check if it's a function
    sql_text = load_sql(sql_path)
    is_function, function_name, schema = _detect_function_in_sql(sql_text)

    # Get types — try app registry first, fall back to test registry
    try:
        InputType, OutputType = get_sql_types(sql_path)
    except ValueError:
        from tests.sql.types import get_sql_types as get_test_sql_types

        InputType, OutputType = get_test_sql_types(sql_path)
    # Type annotation to help type checker understand OutputType is Type[BaseModel]
    OutputTypeClass: type[BaseModel] = OutputType

    # Prepare parameters
    if params:
        sql_params = params.to_tuple()
    else:
        sql_params = ()

    # Execute query - handle functions vs raw SQL differently
    if is_function and function_name:
        # JIT-create the function if it doesn't exist (e.g. test functions)
        await conn.execute(sql_text)
        # Refresh asyncpg's type cache after DROP TYPE/CREATE TYPE changes OIDs
        await conn.reload_schema_state()

        # Call it with SELECT * FROM schema.function_name($1, $2, ...)
        num_params = len(sql_params)
        param_placeholders = ", ".join([f"${i + 1}" for i in range(num_params)])
        function_call_sql = (
            f'SELECT * FROM "{schema}"."{function_name}"({param_placeholders})'
        )
        # Ensure no semicolons or multiple statements (asyncpg doesn't allow multiple commands in prepared statements)
        function_call_sql = function_call_sql.strip().rstrip(";")

        # Fetch rows (use fetch for both single and multi-row - consistent with raw SQL path)
        # Retry once on schema change (e.g. after sql-compile or migrate-db while server is running)
        try:
            if sql_params:
                rows = await conn.fetch(function_call_sql, *sql_params)
            else:
                rows = await conn.fetch(function_call_sql)
        except (
            asyncpg.exceptions.InvalidCachedStatementError,
            asyncpg.exceptions.InternalClientError,
            asyncpg.exceptions.InternalServerError,
        ):
            # After DB drop/restore (migrate-db), OIDs change and connections hold stale
            # prepared statements. reload_schema_state() clears client-side caches and
            # re-introspects types so the retry uses fresh OIDs.
            await conn.reload_schema_state()
            # Re-create the function on this connection (OIDs changed)
            await conn.execute(sql_text)
            if sql_params:
                rows = await conn.fetch(function_call_sql, *sql_params)
            else:
                rows = await conn.fetch(function_call_sql)

        if rows:
            # Convert rows to dicts - asyncpg handles composite types automatically
            # Composite arrays are decoded as list of Record objects
            row_dicts = [dict(row) for row in rows]

            # Recursively convert Record objects to dicts and datetime to strings for composite types
            def convert_records_to_dicts(obj: Any) -> Any:
                """Recursively convert asyncpg Record objects to dicts, datetime to ISO strings, UUID to strings, and JSON strings to dicts."""
                if isinstance(obj, asyncpg.Record):
                    return {k: convert_records_to_dicts(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_records_to_dicts(item) for item in obj]
                elif isinstance(obj, dict):
                    return {k: convert_records_to_dicts(v) for k, v in obj.items()}
                elif isinstance(obj, str) and (
                    obj.startswith("{") or obj.startswith("[")
                ):
                    # Try to parse JSON strings (JSONB fields from PostgreSQL)
                    try:
                        import json

                        parsed = json.loads(obj)
                        return convert_records_to_dicts(
                            parsed
                        )  # Recursively process parsed JSON
                    except (json.JSONDecodeError, ValueError):
                        return obj  # Not JSON, return as-is
                elif hasattr(obj, "isoformat"):  # datetime objects
                    return obj.isoformat()
                elif type(obj).__name__ == "UUID" or (
                    hasattr(obj, "hex") and hasattr(obj, "int")
                ):  # UUID objects
                    return str(obj)  # Convert UUID to string
                else:
                    return obj

            row_dicts = [convert_records_to_dicts(rd) for rd in row_dicts]

            if multi_row:
                # Return list of models for multi-row results
                return [OutputTypeClass.model_validate(rd) for rd in row_dicts]
            else:
                # Return first row for single-row results (backward compatible)
                return OutputTypeClass.model_validate(row_dicts[0])
        else:
            # Function returned no rows - return empty result
            if multi_row:
                return []
            else:
                empty_data: dict[str, Any] = {}
                return OutputTypeClass.model_construct(**empty_data)
    else:
        # It's raw SQL - execute normally
        sql_query = load_sql_query(sql_path)

        try:
            if sql_params:
                rows = await conn.fetch(sql_query, *sql_params)
            else:
                rows = await conn.fetch(sql_query)
        except (
            asyncpg.exceptions.InvalidCachedStatementError,
            asyncpg.exceptions.InternalClientError,
        ):
            await conn.reload_schema_state()
            if sql_params:
                rows = await conn.fetch(sql_query, *sql_params)
            else:
                rows = await conn.fetch(sql_query)

        # Apply nest if we have rows
        if rows:
            nested_data = nest(rows)
            # Always use model_construct since structure is dict-based
            return OutputTypeClass.model_construct(**nested_data)
        else:
            # Return empty result with defaults - use model_construct to avoid validation errors
            # when SQL returns no rows (e.g., CROSS JOINs with empty CTEs)
            # Provide empty dicts for dict fields to avoid validation errors
            empty_nested_data: dict[str, Any] = {}
            return OutputTypeClass.model_construct(**empty_nested_data)
