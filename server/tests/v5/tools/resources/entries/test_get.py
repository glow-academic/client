"""Tests for get_entries."""

import pytest
from tests.helpers import nonexistent_id

from app.routes.v5.tools.resources.entries.create import create_entry
from app.routes.v5.tools.resources.entries.get import get_entries

pytestmark = pytest.mark.asyncio


async def test_gets_created_entry(conn, redis_client):
    created = await create_entry(conn, "activity", redis_client)

    items = await get_entries(conn, [created.id], redis_client)

    assert len(items) == 1
    assert items[0].id == created.id
    assert items[0].entry == "activity"
    assert items[0].active is True


async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_entries(conn, [nonexistent_id()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_entries(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    created = await create_entry(conn, "calls", redis_client)

    # First call populates cache
    items = await get_entries(conn, [created.id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_entries(conn, [created.id], redis_client)
    assert len(items2) == 1
    assert items2[0].entry == "calls"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    created = await create_entry(conn, "domains", redis_client)

    items = await get_entries(conn, [created.id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/entries/get", {"ids": [str(created.id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
