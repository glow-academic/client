"""Integration tests for infra.scenario_context — real DB, no mocks."""

from uuid import uuid4

import pytest

from app.infra.scenario_context import resolve_scenario_context
from app.routes.v5.tools.artifacts.scenario.create import create_scenario
from app.routes.v5.tools.artifacts.scenario.update import update_scenario

pytestmark = pytest.mark.asyncio


async def test_inactive_artifact_returns_inactive_context(pool, redis_client):
    async with pool.acquire() as conn:
        scenario = await create_scenario(conn)
        await update_scenario(conn, scenario.id, active=False)

    result = await resolve_scenario_context(
        pool,
        redis_client,
        scenario_id=scenario.id,
        group_id=uuid4(),
    )

    assert result.active is False
