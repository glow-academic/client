"""Tests for get_systems."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.systems.get import get_systems

pytestmark = pytest.mark.asyncio


async def test_gets_created_system(conn, redis_client):
    system_id = uuid4()
    await conn.execute(
        """
        INSERT INTO systems_resource (id, name, description)
        VALUES ($1, 'test-system', 'Test system desc')
    """,
        system_id,
    )

    items = await get_systems(conn, [system_id], redis_client)

    assert len(items) == 1
    assert items[0].id == system_id
    assert items[0].name == "test-system"
    assert items[0].description == "Test system desc"
    assert items[0].agent_ids == []
    assert items[0].active is True


async def test_returns_empty_for_missing_system(conn, redis_client):
    items = await get_systems(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_systems(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    system_id = uuid4()
    await conn.execute(
        """
        INSERT INTO systems_resource (id, name) VALUES ($1, 'test-system-cache-hit')
    """,
        system_id,
    )

    # First call populates cache
    items = await get_systems(conn, [system_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_systems(conn, [system_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-system-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    system_id = uuid4()
    await conn.execute(
        """
        INSERT INTO systems_resource (id, name) VALUES ($1, 'test-system-bypass')
    """,
        system_id,
    )

    items = await get_systems(conn, [system_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/systems/get", {"ids": [str(system_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
