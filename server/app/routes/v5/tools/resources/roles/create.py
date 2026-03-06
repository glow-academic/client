"""Roles CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.roles.get import get_roles
from app.routes.v5.tools.resources.roles.types import GetRoleResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_role(
    conn: asyncpg.Connection,
    role: str,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetRoleResponse:
    """Create a role resource (upsert on UNIQUE (role, name) constraint)."""
    role_id = await conn.fetchval(
        """
        INSERT INTO roles_resource (role, name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $5)
        ON CONFLICT (role, name) DO UPDATE SET role = EXCLUDED.role
        RETURNING id
        """,
        role,
        name,
        description,
        not soft,
        mcp,
    )
    await invalidate_tags(["resources", "roles"], redis=redis)
    items = await get_roles(conn, [role_id], redis, bypass_cache=True)
    return items[0]
