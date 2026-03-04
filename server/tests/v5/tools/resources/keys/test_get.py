"""Tests for get_keys."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.keys.get import get_keys

pytestmark = pytest.mark.asyncio


async def test_gets_created_key(conn, redis_client):
    key_id = await conn.fetchval("""
        INSERT INTO keys_resource (key, name, description)
        VALUES ('sk-test-123', 'test-key', 'Test key desc')
        RETURNING id
    """)

    items = await get_keys(conn, [key_id], redis_client)

    assert len(items) == 1
    assert items[0].id == key_id
    assert items[0].key == "sk-test-123"
    assert items[0].name == "test-key"
    assert items[0].description == "Test key desc"
    assert items[0].active is True


async def test_returns_empty_for_missing_key(conn, redis_client):
    items = await get_keys(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_keys(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    key_id = await conn.fetchval("""
        INSERT INTO keys_resource (key, name) VALUES ('sk-cache', 'test-key-cache-hit')
        RETURNING id
    """)

    # First call populates cache
    items = await get_keys(conn, [key_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_keys(conn, [key_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-key-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    key_id = await conn.fetchval("""
        INSERT INTO keys_resource (key, name) VALUES ('sk-bypass', 'test-key-bypass')
        RETURNING id
    """)

    items = await get_keys(conn, [key_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/keys/get", {"ids": [str(key_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
