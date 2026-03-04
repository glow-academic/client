"""Tests for get_tools."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.tools.get import get_tools
from tests.seed_ids import USE_VOICES_TOOL_ID

pytestmark = pytest.mark.asyncio


async def test_gets_existing_tool(conn, redis_client):
    items = await get_tools(conn, [USE_VOICES_TOOL_ID], redis_client)

    assert len(items) == 1
    assert items[0].id == USE_VOICES_TOOL_ID
    assert items[0].name == "use_voices"
    assert items[0].active is True


async def test_returns_empty_for_missing_tool(conn, redis_client):
    items = await get_tools(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_tools(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    # First call — populates cache from DB
    items = await get_tools(conn, [USE_VOICES_TOOL_ID], redis_client)
    assert len(items) == 1

    # Second call — should serve from cache (same result)
    items2 = await get_tools(conn, [USE_VOICES_TOOL_ID], redis_client)
    assert len(items2) == 1
    assert items2[0].id == items[0].id
    assert items2[0].name == items[0].name


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    # Call with bypass — should not write to cache
    items = await get_tools(conn, [USE_VOICES_TOOL_ID], redis_client, bypass_cache=True)
    assert len(items) == 1

    # Cache should be empty
    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/tools/get", {"ids": [str(USE_VOICES_TOOL_ID)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
