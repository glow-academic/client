"""Tools layer: Persona duplicate — pure data access, no permissions or caching."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    ToolsDuplicatePersonaSqlParams,
    ToolsDuplicatePersonaSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_duplicate_persona_complete.sql"


async def duplicate_persona_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    persona_id: UUID,
    name_resource_id: UUID,
    soft: bool = False,
) -> ToolsDuplicatePersonaSqlRow:
    """Duplicate a persona, linking to existing resources.

    Pure data access — no transaction management, no cache invalidation, no pool.
    The caller owns the transaction boundary and cache invalidation.

    Args:
        conn: Database connection (caller manages transaction).
        profile_id: Acting user's profile ID.
        persona_id: Persona to duplicate.
        name_resource_id: Pre-created name resource for the copy.
        soft: If True, creates duplicate with active=false (dormant).

    Returns the ToolsDuplicatePersonaSqlRow result.
    Raises ValueError if the persona is not found.
    """
    active_value = not soft
    params = ToolsDuplicatePersonaSqlParams(
        persona_id=persona_id,
        profile_id=profile_id,
        name_resource_id=name_resource_id,
        active_value=active_value,
    )

    result = cast(
        ToolsDuplicatePersonaSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.new_persona_id:
        raise ValueError(f"Persona not found: {persona_id}")

    return result
