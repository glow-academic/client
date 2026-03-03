"""Tools layer: Persona delete — pure data access, no permissions or caching."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    ToolsDeletePersonaSqlParams,
    ToolsDeletePersonaSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_delete_persona_complete.sql"


async def delete_persona_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    persona_id: UUID,
    soft: bool = False,
) -> ToolsDeletePersonaSqlRow:
    """Delete a persona with usage check.

    Pure data access — no transaction management, no cache invalidation, no pool.
    The caller owns the transaction boundary and cache invalidation.

    Args:
        conn: Database connection (caller manages transaction).
        profile_id: Acting user's profile ID.
        persona_id: Persona to delete.
        soft: If True, sets active=false instead of hard deleting.

    Returns the ToolsDeletePersonaSqlRow result.
    Raises ValueError if persona is in use or not found/deleted.
    """
    params = ToolsDeletePersonaSqlParams(
        persona_id=persona_id, profile_id=profile_id, soft=soft
    )

    result = cast(
        ToolsDeletePersonaSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result:
        raise ValueError(f"Failed to check persona usage: {persona_id}")

    usage_count = result.usage_count or 0
    if usage_count > 0:
        raise ValueError("Cannot delete persona that is in use by scenarios")

    if not result.deleted:
        raise ValueError(f"Persona not found: {persona_id}")

    return result
