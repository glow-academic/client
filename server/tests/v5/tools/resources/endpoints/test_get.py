"""Tests for get_endpoints."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.endpoints.get import get_endpoints

pytestmark = pytest.mark.asyncio


async def test_gets_created_endpoint(conn, redis_client):
    ep_id = await conn.fetchval("""
        INSERT INTO endpoints_resource (base_url)
        VALUES ('https://api.example.com')
        RETURNING id
    """)

    items = await get_endpoints(conn, [ep_id], redis_client)

    assert len(items) == 1
    assert items[0].id == ep_id
    assert items[0].base_url == "https://api.example.com"
    assert items[0].active is True


async def test_returns_empty_for_missing_endpoint(conn, redis_client):
    items = await get_endpoints(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_endpoints(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    ep_id = await conn.fetchval("""
        INSERT INTO endpoints_resource (base_url)
        VALUES ('https://cache-hit.example.com')
        RETURNING id
    """)

    items = await get_endpoints(conn, [ep_id], redis_client)
    assert len(items) == 1

    items2 = await get_endpoints(conn, [ep_id], redis_client)
    assert len(items2) == 1
    assert items2[0].base_url == "https://cache-hit.example.com"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    ep_id = await conn.fetchval("""
        INSERT INTO endpoints_resource (base_url)
        VALUES ('https://bypass.example.com')
        RETURNING id
    """)

    items = await get_endpoints(conn, [ep_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/endpoints/get", {"ids": [str(ep_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
