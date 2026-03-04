"""Tests for get_agents."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.agents.get import get_agents

pytestmark = pytest.mark.asyncio


async def test_gets_created_agent(conn, redis_client):
    agent_id = await conn.fetchval("""
        INSERT INTO agents_resource (name, description)
        VALUES ('test-agent', 'Test agent desc')
        RETURNING id
    """)

    items = await get_agents(conn, [agent_id], redis_client)

    assert len(items) == 1
    assert items[0].id == agent_id
    assert items[0].name == "test-agent"
    assert items[0].description == "Test agent desc"
    assert items[0].department_ids == []
    assert items[0].tool_ids == []
    assert items[0].instruction_ids == []
    assert items[0].voices == []
    assert items[0].active is True


async def test_returns_empty_for_missing_agent(conn, redis_client):
    items = await get_agents(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_agents(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    agent_id = await conn.fetchval("""
        INSERT INTO agents_resource (name) VALUES ('test-agent-cache-hit')
        RETURNING id
    """)

    items = await get_agents(conn, [agent_id], redis_client)
    assert len(items) == 1

    items2 = await get_agents(conn, [agent_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-agent-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    agent_id = await conn.fetchval("""
        INSERT INTO agents_resource (name) VALUES ('test-agent-bypass')
        RETURNING id
    """)

    items = await get_agents(conn, [agent_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/agents/get", {"ids": [str(agent_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
