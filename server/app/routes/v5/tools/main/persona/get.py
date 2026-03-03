"""Tools layer: Persona ID fetching — pure data access, no permissions or caching."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    ToolsGetPersonaSqlParams,
    ToolsGetPersonaSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_get_persona_complete.sql"


async def get_persona_ids_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    persona_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
) -> ToolsGetPersonaSqlRow:
    """Fetch all resource IDs for a persona from junctions.

    Pure data access — no caching, no permissions, no pool management.
    The caller owns the connection and any transaction boundary.

    Args:
        conn: Database connection (caller manages).
        profile_id: Acting user's profile ID.
        persona_id: Persona to fetch IDs for (None for create mode).
        draft_id: Optional draft ID override.
        group_id: Optional group context.
        user_department_ids: User's department IDs for filtering.

    Returns:
        ToolsGetPersonaSqlRow with all resource IDs.

    Raises:
        ValueError if the query returns no result.
    """
    params = ToolsGetPersonaSqlParams(
        profile_id=profile_id,
        persona_id=persona_id,
        draft_id=draft_id,
        group_id=group_id,
        user_department_ids=user_department_ids or [],
    )

    result = cast(
        ToolsGetPersonaSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result:
        raise ValueError(f"Failed to fetch persona IDs: {persona_id}")

    return result
