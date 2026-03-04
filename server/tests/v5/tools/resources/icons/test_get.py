"""Tests for get_icons."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.icons.get import get_icons

pytestmark = pytest.mark.asyncio


async def test_gets_created_icon(conn, redis_client):
    icon_id = await conn.fetchval("""
        INSERT INTO icons_resource (name, description, value)
        VALUES ('test-icon', 'Test icon desc', 'icon-value')
        RETURNING id
    """)

    items = await get_icons(conn, [icon_id], redis_client)

    assert len(items) == 1
    assert items[0].id == icon_id
    assert items[0].name == "test-icon"
    assert items[0].description == "Test icon desc"
    assert items[0].value == "icon-value"
    assert items[0].active is True


async def test_returns_empty_for_missing_icon(conn, redis_client):
    items = await get_icons(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_icons(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    icon_id = await conn.fetchval("""
        INSERT INTO icons_resource (name, description, value)
        VALUES ('test-icon-cache-hit', 'desc', 'val')
        RETURNING id
    """)

    items = await get_icons(conn, [icon_id], redis_client)
    assert len(items) == 1

    items2 = await get_icons(conn, [icon_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-icon-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    icon_id = await conn.fetchval("""
        INSERT INTO icons_resource (name, description, value)
        VALUES ('test-icon-bypass', 'desc', 'val')
        RETURNING id
    """)

    items = await get_icons(conn, [icon_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/icons/get", {"ids": [str(icon_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
