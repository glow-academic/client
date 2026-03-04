"""Tests for get_names."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.names.get import get_names

pytestmark = pytest.mark.asyncio


async def test_gets_created_name(conn, redis_client):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-for-get')
        RETURNING id
    """)

    items = await get_names(conn, [name_id], redis_client)

    assert len(items) == 1
    assert items[0].id == name_id
    assert items[0].name == "test-name-for-get"
    assert items[0].active is True


async def test_returns_empty_for_missing_name(conn, redis_client):
    items = await get_names(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_names(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-cache-hit')
        RETURNING id
    """)

    # First call populates cache
    items = await get_names(conn, [name_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_names(conn, [name_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-name-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-bypass')
        RETURNING id
    """)

    items = await get_names(conn, [name_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/names/get", {"ids": [str(name_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
