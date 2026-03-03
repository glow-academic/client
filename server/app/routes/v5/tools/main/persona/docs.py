"""Tools layer: Persona docs — pure data access, no permissions or caching."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    ToolsGetPersonaDocsSqlParams,
    ToolsGetPersonaDocsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_get_persona_docs_complete.sql"


async def get_persona_docs_internal(
    conn: asyncpg.Connection,
    entity_id: UUID | None = None,
) -> ToolsGetPersonaDocsSqlRow | None:
    """Look up persona name resource ID for docs metadata.

    Pure data access — no caching, no permissions, no pool management.
    The caller owns the connection. Static docs config and metadata
    computation are the caller's responsibility.

    Args:
        conn: Database connection (caller manages).
        entity_id: Persona ID to look up name for.

    Returns:
        ToolsGetPersonaDocsSqlRow with name_id, or None if not found.
    """
    if entity_id is None:
        return None

    params = ToolsGetPersonaDocsSqlParams(p_entity_id=entity_id)

    result = cast(
        ToolsGetPersonaDocsSqlRow | None,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    return result
