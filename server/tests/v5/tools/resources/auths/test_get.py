"""Tests for get_auths."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.auths.get import get_auths

pytestmark = pytest.mark.asyncio


async def test_gets_created_auth(conn, redis_client):
    auth_id = await conn.fetchval("""
        INSERT INTO auths_resource (name, description, slug, protocol)
        VALUES ('test-auth', 'Test auth desc', 'test-slug', 'oidc')
        RETURNING id
    """)

    items = await get_auths(conn, [auth_id], redis_client)

    assert len(items) == 1
    assert items[0].id == auth_id
    assert items[0].name == "test-auth"
    assert items[0].description == "Test auth desc"
    assert items[0].slug == "test-slug"
    assert items[0].protocol == "oidc"
    assert items[0].active is True


async def test_returns_empty_for_missing_auth(conn, redis_client):
    items = await get_auths(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_auths(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    auth_id = await conn.fetchval("""
        INSERT INTO auths_resource (name) VALUES ('test-auth-cache-hit')
        RETURNING id
    """)

    # First call populates cache
    items = await get_auths(conn, [auth_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_auths(conn, [auth_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-auth-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    auth_id = await conn.fetchval("""
        INSERT INTO auths_resource (name) VALUES ('test-auth-bypass')
        RETURNING id
    """)

    items = await get_auths(conn, [auth_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/auths/get", {"ids": [str(auth_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
