"""SQL helper utility - DHH-style SQL file loading.

Routes have full control over transaction and execution.
This follows DHH principles - route owns the execution.
"""

from pathlib import Path
from typing import Any, Protocol, cast

import asyncpg  # type: ignore
from pydantic import BaseModel
from utils.sql_nest import nest

# Cache for SQL metadata introspection to avoid repeated PREPARE calls
# Type: dict[str, SQLMetadata | None]
_metadata_cache: dict[str, Any] = {}


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
    sql_path = Path(__file__).parent.parent / file_path
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
    pattern = r'CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:(\w+)\.)?(\w+)\s*\('
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
) -> BaseModel:
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
    from typing import Type

    from app.sql.types import get_sql_types, load_sql_query

    # Load SQL file to check if it's a function
    sql_text = load_sql(sql_path)
    is_function, function_name, schema = _detect_function_in_sql(sql_text)
    
    # Get types (works for both functions and raw SQL)
    InputType, OutputType = get_sql_types(sql_path)
    # Type annotation to help type checker understand OutputType is Type[BaseModel]
    OutputTypeClass: Type[BaseModel] = OutputType

    # Prepare parameters
    if params:
        sql_params = params.to_tuple()
    else:
        sql_params = ()

    # Execute query - handle functions vs raw SQL differently
    if is_function and function_name:
        # It's a function - call it with SELECT * FROM schema.function_name($1, $2, ...)
        num_params = len(sql_params)
        param_placeholders = ", ".join([f"${i+1}" for i in range(num_params)])
        function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"({param_placeholders})'
        
        # Functions return single row (RETURNS TABLE)
        if sql_params:
            row = await conn.fetchrow(function_call_sql, *sql_params)
        else:
            row = await conn.fetchrow(function_call_sql)
        
        if row:
            # Convert row to dict - asyncpg handles composite types automatically
            # Composite arrays are decoded as list of dicts/records
            row_dict = dict(row)
            # Use model_validate since we have the actual data structure
            # asyncpg automatically decodes composite arrays to Python objects
            return OutputTypeClass.model_validate(row_dict)
        else:
            # Function returned no rows - return empty result
            empty_data: dict[str, Any] = {}
            return OutputTypeClass.model_construct(**empty_data)
    else:
        # It's raw SQL - execute normally
        sql_query = load_sql_query(sql_path)
        
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

