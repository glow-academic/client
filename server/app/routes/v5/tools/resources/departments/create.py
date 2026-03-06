"""Departments CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.departments.types import GetDepartmentResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_department(
    conn: asyncpg.Connection,
    name: str = "",
    description: str = "",
    redis: Redis = None,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetDepartmentResponse:
    """Create a department resource (plain INSERT — no unique constraint)."""
    dept_id = await conn.fetchval(
        """
        INSERT INTO departments_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
        """,
        name,
        description,
        not soft,
        mcp,
    )
    await invalidate_tags(["resources", "departments"], redis=redis)
    items = await get_departments(conn, [dept_id], redis, bypass_cache=True)
    return items[0]
