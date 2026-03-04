"""Tests for create_agent."""

import pytest

from app.routes.v5.tools.resources.agents.create import create_agent
from app.routes.v5.tools.resources.agents.get import get_agents

pytestmark = pytest.mark.asyncio


async def test_creates_new_agent(conn, redis_client):
    result = await create_agent(conn, "test-agent", "desc", redis_client)

    assert result.name == "test-agent"
    assert result.description == "desc"
    assert result.active is True
    assert result.mcp is False


async def test_visible_via_get(conn, redis_client):
    result = await create_agent(conn, "test-agent-visible", redis=redis_client)

    items = await get_agents(conn, [result.id], redis_client, bypass_cache=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].name == "test-agent-visible"


async def test_two_creates_produce_different_ids(conn, redis_client):
    first = await create_agent(conn, "test-agent-dup", redis=redis_client)
    second = await create_agent(conn, "test-agent-dup", redis=redis_client)

    assert first.id != second.id


async def test_sets_mcp_flag(conn, redis_client):
    result = await create_agent(conn, "mcp-agent", redis=redis_client, mcp=True)

    assert result.mcp is True
    assert result.generated is True
