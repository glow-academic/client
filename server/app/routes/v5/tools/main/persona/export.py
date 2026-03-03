"""Tools layer: Persona export — pure data access, no permissions or caching."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    ToolsExportPersonasSqlParams,
    ToolsExportPersonasSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_export_personas_complete.sql"


async def export_personas_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    *,
    search: str | None = None,
    scenario_ids: list[UUID] | None = None,
    field_ids: list[UUID] | None = None,
    filter_department_ids: list[UUID] | None = None,
) -> ToolsExportPersonasSqlRow:
    """Export personas with full resource IDs and values.

    Pure data access — no caching, no permissions, no pool management.
    The caller owns the connection. CSV generation and upload handling
    are the caller's responsibility.

    Args:
        conn: Database connection (caller manages).
        profile_id: Acting user's profile ID (used for department access check in SQL).
        search: Text search on persona name/description.
        scenario_ids: Filter by scenario IDs.
        field_ids: Filter by field IDs.
        filter_department_ids: Filter by department IDs.

    Returns:
        ToolsExportPersonasSqlRow with rows[] of full persona data.

    Raises:
        ValueError if the query returns no result.
    """
    params = ToolsExportPersonasSqlParams(
        profile_id=profile_id,
        search=search,
        scenario_ids=scenario_ids,
        field_ids=field_ids,
        filter_department_ids=filter_department_ids,
    )

    result = cast(
        ToolsExportPersonasSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result:
        raise ValueError("Failed to export personas")

    return result
