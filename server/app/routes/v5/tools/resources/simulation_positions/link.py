"""simulation_positions/link internal — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/link_simulation_positions_complete.sql"


class LinkSimulationPositionsSqlParams(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

    def to_tuple(self) -> tuple:
        return (self.resource_id, self.group_id, self.tool_id)


class LinkSimulationPositionsSqlRow(BaseModel):
    simulation_positions_id: UUID | None = None


async def link_simulation_positions_internal(
    conn: asyncpg.Connection,
    resource_id: UUID,
    group_id: UUID,
    tool_id: UUID,
) -> UUID:
    """Record tool call tracking for linking an existing simulation position resource.

    Can be called directly from other routes (e.g. socket handlers, artifact saves)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = LinkSimulationPositionsSqlParams(
        resource_id=resource_id,
        group_id=group_id,
        tool_id=tool_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    result_row = LinkSimulationPositionsSqlRow.model_validate(
        result.model_dump() if hasattr(result, "model_dump") else result
    )
    if not result_row.simulation_positions_id:
        raise ValueError(f"Failed to link simulation position: {resource_id}")
    return result_row.simulation_positions_id
