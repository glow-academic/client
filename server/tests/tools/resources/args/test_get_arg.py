"""Tests for get_args."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.args.get import get_args
from tests.seed_ids import SEED_ARG_ID

pytestmark = pytest.mark.asyncio


async def test_get_args_returns_seed(conn, redis_client):
    items = await get_args(conn, [SEED_ARG_ID], redis_client)

    assert len(items) == 1
    assert items[0].id == SEED_ARG_ID
    assert items[0].name is not None
    assert items[0].active is True


async def test_get_args_returns_empty_for_missing(conn, redis_client):
    items = await get_args(conn, [uuid4()], redis_client)

    assert items == []


async def test_get_args_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_args(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    # First call populates cache
    items = await get_args(conn, [SEED_ARG_ID], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_args(conn, [SEED_ARG_ID], redis_client)
    assert len(items2) == 1
    assert items2[0].id == items[0].id


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    items = await get_args(conn, [SEED_ARG_ID], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/args/get", {"ids": [str(SEED_ARG_ID)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
