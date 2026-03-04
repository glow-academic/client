"""Args CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args.types import GetArgResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_arg(
    conn: asyncpg.Connection,
    name: str,
    field_type: str,
    redis: Redis,
    mcp: bool = False,
    description: str = "",
    required: bool = False,
    default_value: str = "",
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetArgResponse:
    """Create an arg resource (plain INSERT — no unique constraint)."""
    arg_id = await conn.fetchval(
        """
        INSERT INTO args_resource (name, description, field_type, required, default_value, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true, $6, $6)
        RETURNING id
        """,
        name,
        description,
        field_type,
        required,
        default_value,
        mcp,
    )

    await invalidate_tags(["resources", "args"], redis=redis)
    items = await get_args(conn, [arg_id], redis, bypass_cache=True)
    return items[0]
