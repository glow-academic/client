"""Tests for get_slugs."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.slugs.get import get_slugs

pytestmark = pytest.mark.asyncio


async def test_gets_created_slug(conn, redis_client):
    slug_id = await conn.fetchval("""
        INSERT INTO slugs_resource (value)
        VALUES ('test-slug')
        RETURNING id
    """)

    items = await get_slugs(conn, [slug_id], redis_client)

    assert len(items) == 1
    assert items[0].id == slug_id
    assert items[0].value == "test-slug"
    assert items[0].active is True


async def test_returns_empty_for_missing_slug(conn, redis_client):
    items = await get_slugs(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_slugs(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    slug_id = await conn.fetchval("""
        INSERT INTO slugs_resource (value)
        VALUES ('test-slug-cache-hit')
        RETURNING id
    """)

    items = await get_slugs(conn, [slug_id], redis_client)
    assert len(items) == 1

    items2 = await get_slugs(conn, [slug_id], redis_client)
    assert len(items2) == 1
    assert items2[0].value == "test-slug-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    slug_id = await conn.fetchval("""
        INSERT INTO slugs_resource (value)
        VALUES ('test-slug-bypass')
        RETURNING id
    """)

    items = await get_slugs(conn, [slug_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/slugs/get", {"ids": [str(slug_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
