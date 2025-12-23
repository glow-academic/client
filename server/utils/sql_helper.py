"""SQL helper utility - DHH-style SQL file loading.

Routes have full control over transaction and execution.
This follows DHH principles - route owns the execution.
"""

from pathlib import Path
from typing import Any, Protocol, cast

import asyncpg  # type: ignore
from pydantic import BaseModel
from utils.sql_nest import nest_many


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
) -> BaseModel:
    """Execute SQL query with typed parameters and return typed result.

    Loads SQL with types, executes query, applies nest_many, and returns
    typed OutputType instance. This provides a convenient wrapper for
    the common pattern of: get_sql_types -> fetch -> nest_many -> parse.

    Args:
        conn: Database connection
        sql_path: Relative path from server root (e.g., "app/sql/v3/agents/get_agent_new_complete.sql")
        params: Optional Pydantic model instance with parameters (e.g., GetAgentNewSqlParams)
        list_prefixes: Optional set of list prefixes for nest_many (e.g., {"model_mapping", "department_mapping"})

    Returns:
        Typed result matching the SQL output type (e.g., GetAgentNewSqlRow)

    Example:
        ```python
        from app.sql.types import GetAgentNewSqlParams, GetAgentNewSqlRow, load_sql_query
        from typing import cast
        
        params = GetAgentNewSqlParams(profile_id="...")
        result = cast(
            GetAgentNewSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v3/agents/get_agent_new_complete.sql",
                params=params,
                list_prefixes={"model_mapping", "department_mapping"}
            )
        )
        # result is typed as GetAgentNewSqlRow
        ```
    """
    # Import here to avoid circular imports
    from typing import Type

    from app.sql.types import get_sql_types, load_sql_query

    # Load SQL query and types separately
    sql_query = load_sql_query(sql_path)
    InputType, OutputType = get_sql_types(sql_path)
    # Type annotation to help type checker understand OutputType is Type[BaseModel]
    OutputTypeClass: Type[BaseModel] = OutputType

    # Execute query
    if params:
        sql_params = params.to_tuple()
        rows = await conn.fetch(sql_query, *sql_params)
    else:
        rows = await conn.fetch(sql_query)

    # Apply nest_many if we have rows
    if rows:
        nested_data = nest_many(rows, list_prefixes=list_prefixes or set())
        # Parse into typed output
        return OutputTypeClass(**nested_data)
    else:
        # Return empty result with defaults
        return OutputTypeClass()

