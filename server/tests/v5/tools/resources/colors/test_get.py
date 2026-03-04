"""Tests for get_colors."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.colors.get import get_colors

pytestmark = pytest.mark.asyncio


async def test_gets_created_color(conn, redis_client):
    color_id = await conn.fetchval("""
        INSERT INTO colors_resource (name, description, hex_code)
        VALUES ('test-color', 'Test color desc', '#FF0000')
        RETURNING id
    """)

    items = await get_colors(conn, [color_id], redis_client)

    assert len(items) == 1
    assert items[0].id == color_id
    assert items[0].name == "test-color"
    assert items[0].description == "Test color desc"
    assert items[0].hex_code == "#FF0000"
    assert items[0].active is True


async def test_returns_empty_for_missing_color(conn, redis_client):
    items = await get_colors(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_colors(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    color_id = await conn.fetchval("""
        INSERT INTO colors_resource (name, description, hex_code)
        VALUES ('test-color-cache-hit', 'desc', '#00FF00')
        RETURNING id
    """)

    items = await get_colors(conn, [color_id], redis_client)
    assert len(items) == 1

    items2 = await get_colors(conn, [color_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-color-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    color_id = await conn.fetchval("""
        INSERT INTO colors_resource (name, description, hex_code)
        VALUES ('test-color-bypass', 'desc', '#0000FF')
        RETURNING id
    """)

    items = await get_colors(conn, [color_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/colors/get", {"ids": [str(color_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
