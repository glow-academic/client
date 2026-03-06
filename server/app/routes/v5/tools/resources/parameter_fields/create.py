"""Parameter Fields CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.parameter_fields.get import get_parameter_fields
from app.routes.v5.tools.resources.parameter_fields.types import (
    GetParameterFieldResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_parameter_field(
    conn: asyncpg.Connection,
    field_id: UUID,
    redis: Redis,
    parameter_id: UUID | None = None,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetParameterFieldResponse:
    """Create a parameter_field resource (plain INSERT — no unique constraint)."""
    parameter_field_id = await conn.fetchval(
        """
        INSERT INTO parameter_fields_resource (field_id, parameter_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
        """,
        field_id,
        parameter_id,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "parameter_fields"], redis=redis)
    items = await get_parameter_fields(
        conn, [parameter_field_id], redis, bypass_cache=True
    )
    return items[0]
