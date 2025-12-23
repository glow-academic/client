"""SQL helper utility - DHH-style SQL file loading.

Routes have full control over transaction and execution.
This follows DHH principles - route owns the execution.
"""

from pathlib import Path
from typing import Any, Protocol, cast

import asyncpg  # type: ignore
from pydantic import BaseModel
from utils.sql_nest import nest_many

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


async def execute_sql_typed(
    conn: asyncpg.Connection,
    sql_path: str,
    params: HasToTuple | None = None,
    list_prefixes: set[str] | None = None,
    dict_prefixes: dict[str, str] | None = None,
) -> BaseModel:
    """Execute SQL query with typed parameters and return typed result.

    Loads SQL with types, executes query, applies nest_many, and returns
    typed OutputType instance. This provides a convenient wrapper for
    the common pattern of: get_sql_types -> fetch -> nest_many -> parse.

    Auto-detects list_prefixes and dict_prefixes from SQL column names if not provided.
    - list_prefixes: Detected from columns with __ that appear multiple times
    - dict_prefixes: Detected if list prefix has a prefix__id column

    Args:
        conn: Database connection
        sql_path: Relative path from server root (e.g., "app/sql/v3/agents/get_agent_new_complete.sql")
        params: Optional Pydantic model instance with parameters (e.g., GetAgentNewSqlParams)
        list_prefixes: Optional set of list prefixes for nest_many (auto-detected if None)
        dict_prefixes: Optional dict mapping list prefix to key field name (auto-detected if None)

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
                # list_prefixes and dict_prefixes auto-detected from column names!
            )
        )
        # result is typed as GetAgentNewSqlRow
        ```
    """
    # Import here to avoid circular imports
    from typing import Type

    from app.sql.types import get_sql_types, load_sql_query
    from scripts.sql_introspect import ColumnMetadata, introspect_sql_file
    from scripts.sql_typegen import detect_dict_prefixes, detect_list_prefixes

    # Load SQL query and types separately
    sql_query = load_sql_query(sql_path)
    InputType, OutputType = get_sql_types(sql_path)
    # Type annotation to help type checker understand OutputType is Type[BaseModel]
    OutputTypeClass: Type[BaseModel] = OutputType

    # Auto-detect list_prefixes and dict_prefixes if not provided
    if list_prefixes is None or dict_prefixes is None:
        # Get or cache metadata
        if sql_path not in _metadata_cache:
            metadata = await introspect_sql_file(sql_path, conn)
            if metadata.error:
                # If introspection fails, fall back to empty sets
                _metadata_cache[sql_path] = None  # type: ignore
            else:
                _metadata_cache[sql_path] = metadata
        
        cached_metadata = _metadata_cache.get(sql_path)
        if cached_metadata is not None and cached_metadata.returns:
            metadata = cached_metadata
            # Auto-detect list_prefixes
            if list_prefixes is None:
                list_prefixes = detect_list_prefixes(cached_metadata.returns)
            
            # Auto-detect dict_prefixes
            if dict_prefixes is None and list_prefixes:
                dict_prefixes = detect_dict_prefixes(cached_metadata.returns, list_prefixes)
        else:
            # Fallback to empty sets if introspection failed
            if list_prefixes is None:
                list_prefixes = set()
            if dict_prefixes is None:
                dict_prefixes = {}

    # Execute query
    if params:
        sql_params = params.to_tuple()
        rows = await conn.fetch(sql_query, *sql_params)
    else:
        rows = await conn.fetch(sql_query)

    # Apply nest_many if we have rows
    if rows:
        nested_data = nest_many(
            rows,
            list_prefixes=list_prefixes or set(),
            dict_prefixes=dict_prefixes,
        )
        # If dict_prefixes is used, structure won't match type definition (lists vs dicts)
        # Use model_construct to bypass validation while still getting typed access
        if dict_prefixes:
            return OutputTypeClass.model_construct(**nested_data)
        else:
            # Parse into typed output with validation
            return OutputTypeClass(**nested_data)
    else:
        # Return empty result with defaults - use model_construct to avoid validation errors
        # when SQL returns no rows (e.g., CROSS JOINs with empty CTEs)
        return OutputTypeClass.model_construct()

