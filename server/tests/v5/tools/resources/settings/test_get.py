"""Tests for get_settings."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.settings.get import get_settings

pytestmark = pytest.mark.asyncio


async def test_gets_created_setting(conn, redis_client):
    setting_id = await conn.fetchval("""
        INSERT INTO settings_resource (name, description)
        VALUES ('test-setting', 'Test setting desc')
        RETURNING id
    """)

    items = await get_settings(conn, [setting_id], redis_client)

    assert len(items) == 1
    assert items[0].id == setting_id
    assert items[0].name == "test-setting"
    assert items[0].description == "Test setting desc"
    assert items[0].active is True


async def test_returns_empty_for_missing_setting(conn, redis_client):
    items = await get_settings(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_settings(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    setting_id = await conn.fetchval("""
        INSERT INTO settings_resource (name) VALUES ('test-setting-cache-hit')
        RETURNING id
    """)

    # First call populates cache
    items = await get_settings(conn, [setting_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_settings(conn, [setting_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-setting-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    setting_id = await conn.fetchval("""
        INSERT INTO settings_resource (name) VALUES ('test-setting-bypass')
        RETURNING id
    """)

    items = await get_settings(conn, [setting_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/settings/get", {"ids": [str(setting_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
