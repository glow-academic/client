"""flags/link internal — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/link_flags_complete.sql"


class LinkFlagsSqlParams(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

    def to_tuple(self) -> tuple:
        return (self.resource_id, self.group_id, self.tool_id)


class LinkFlagsSqlRow(BaseModel):
    flag_id: UUID | None = None


async def link_flags_internal(
    conn: asyncpg.Connection,
    resource_id: UUID,
    group_id: UUID,
    tool_id: UUID,
) -> UUID:
    """Record tool call tracking for linking an existing flag resource.

    Can be called directly from other routes (e.g. socket handlers, artifact saves)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = LinkFlagsSqlParams(
        resource_id=resource_id,
        group_id=group_id,
        tool_id=tool_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    result_row = LinkFlagsSqlRow.model_validate(
        result.model_dump() if hasattr(result, "model_dump") else result
    )
    if not result_row.flag_id:
        raise ValueError(f"Failed to link flag: {resource_id}")
    return result_row.flag_id
