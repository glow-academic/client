"""Scenario Rubrics CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.scenario_rubrics.get import get_scenario_rubrics
from app.routes.v5.tools.resources.scenario_rubrics.types import (
    GetScenarioRubricResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_scenario_rubric(
    conn: asyncpg.Connection,
    scenario_id: UUID,
    rubric_id: UUID,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetScenarioRubricResponse:
    """Create a scenario_rubric resource (plain INSERT — no unique constraint)."""
    row_id = await conn.fetchval(
        """
        INSERT INTO scenario_rubrics_resource (scenario_id, rubric_id, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
        """,
        scenario_id,
        rubric_id,
        mcp,
    )

    await invalidate_tags(["resources", "scenario_rubrics"], redis=redis)
    items = await get_scenario_rubrics(conn, [row_id], redis, bypass_cache=True)
    return items[0]
