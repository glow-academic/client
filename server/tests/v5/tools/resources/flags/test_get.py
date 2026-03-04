"""Tests for get_flags."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.flags.get import get_flags

pytestmark = pytest.mark.asyncio


async def test_gets_created_flag(conn, redis_client):
    flag_id = await conn.fetchval("""
        INSERT INTO flags_resource (name, description, type, icon)
        VALUES ('test-flag', 'Test flag desc', 'active', 'star')
        RETURNING id
    """)

    items = await get_flags(conn, [flag_id], redis_client)

    assert len(items) == 1
    assert items[0].id == flag_id
    assert items[0].name == "test-flag"
    assert items[0].description == "Test flag desc"
    assert items[0].type == "active"
    assert items[0].icon == "star"
    assert items[0].active is True


async def test_returns_empty_for_missing_flag(conn, redis_client):
    items = await get_flags(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_flags(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    flag_id = await conn.fetchval("""
        INSERT INTO flags_resource (name, description, type, icon)
        VALUES ('test-flag-cache-hit', 'desc', 'active', 'star')
        RETURNING id
    """)

    items = await get_flags(conn, [flag_id], redis_client)
    assert len(items) == 1

    items2 = await get_flags(conn, [flag_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-flag-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    flag_id = await conn.fetchval("""
        INSERT INTO flags_resource (name, description, type, icon)
        VALUES ('test-flag-bypass', 'desc', 'active', 'star')
        RETURNING id
    """)

    items = await get_flags(conn, [flag_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/flags/get", {"ids": [str(flag_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
