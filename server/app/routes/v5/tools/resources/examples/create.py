"""Examples CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.examples.get import get_examples
from app.routes.v5.tools.resources.examples.types import GetExampleResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_example(
    conn: asyncpg.Connection,
    example: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetExampleResponse:
    """Create an example resource."""
    example_id = await conn.fetchval(
        """
        INSERT INTO examples_resource (example, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        RETURNING id
    """,
        example,
        mcp,
    )

    await invalidate_tags(["resources", "examples"], redis=redis)
    items = await get_examples(conn, [example_id], redis, bypass_cache=True)
    return items[0]
