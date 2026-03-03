"""Tools layer: Persona list — pure data access, no permissions or caching."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    ToolsGetPersonasListSqlParams,
    ToolsGetPersonasListSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/tools_get_personas_list_complete.sql"


async def list_personas_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    *,
    search: str | None = None,
    scenario_ids: list[UUID] | None = None,
    field_ids: list[UUID] | None = None,
    filter_department_ids: list[UUID] | None = None,
    scenario_search: str | None = None,
    field_search: str | None = None,
    department_search: str | None = None,
    page_size: int = 12,
    page_offset: int = 0,
) -> ToolsGetPersonasListSqlRow:
    """List personas with filtering and pagination.

    Pure data access — no caching, no permissions, no pool management.
    The caller owns the connection. Permissions (can_edit, can_delete, etc.)
    and filter option name hydration are the caller's responsibility.

    Args:
        conn: Database connection (caller manages).
        profile_id: Acting user's profile ID (used for department access check in SQL).
        search: Text search on persona name/description.
        scenario_ids: Filter by scenario IDs.
        field_ids: Filter by field IDs.
        filter_department_ids: Filter by department IDs.
        scenario_search: Search within scenario filter options.
        field_search: Search within field filter options.
        department_search: Search within department filter options.
        page_size: Number of results per page.
        page_offset: Offset for pagination.

    Returns:
        ToolsGetPersonasListSqlRow with personas[], option IDs, and total_count.

    Raises:
        ValueError if the query returns no result.
    """
    params = ToolsGetPersonasListSqlParams(
        profile_id=profile_id,
        search=search,
        scenario_ids=scenario_ids,
        field_ids=field_ids,
        filter_department_ids=filter_department_ids,
        scenario_search=scenario_search,
        field_search=field_search,
        department_search=department_search,
        page_size=page_size,
        page_offset=page_offset,
    )

    result = cast(
        ToolsGetPersonasListSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result:
        raise ValueError("Failed to list personas")

    return result
