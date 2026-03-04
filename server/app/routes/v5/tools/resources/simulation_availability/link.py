"""simulation_availability/link internal — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/link_simulation_availability_complete.sql"


class LinkSimulationAvailabilitySqlParams(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

    def to_tuple(self) -> tuple:
        return (self.resource_id, self.group_id, self.tool_id)


class LinkSimulationAvailabilitySqlRow(BaseModel):
    simulation_availability_id: UUID | None = None


async def link_simulation_availability_internal(
    conn: asyncpg.Connection,
    resource_id: UUID,
    group_id: UUID,
    tool_id: UUID,
) -> UUID:
    """Record tool call tracking for linking an existing simulation availability resource.

    Can be called directly from other routes (e.g. socket handlers, artifact saves)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = LinkSimulationAvailabilitySqlParams(
        resource_id=resource_id,
        group_id=group_id,
        tool_id=tool_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    result_row = LinkSimulationAvailabilitySqlRow.model_validate(
        result.model_dump() if hasattr(result, "model_dump") else result
    )
    if not result_row.simulation_availability_id:
        raise ValueError(f"Failed to link simulation availability: {resource_id}")
    return result_row.simulation_availability_id
