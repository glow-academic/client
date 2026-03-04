"""Tests for get_examples."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.examples.get import get_examples

pytestmark = pytest.mark.asyncio


async def test_gets_created_example(conn, redis_client):
    row_id = await conn.fetchval("""
        INSERT INTO examples_resource (example) VALUES ('test example text')
        RETURNING id
    """)

    items = await get_examples(conn, [row_id], redis_client)

    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].example == "test example text"
    assert items[0].active is True


async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_examples(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_examples(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    row_id = await conn.fetchval("""
        INSERT INTO examples_resource (example) VALUES ('test example cache hit')
        RETURNING id
    """)

    # First call populates cache
    items = await get_examples(conn, [row_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_examples(conn, [row_id], redis_client)
    assert len(items2) == 1
    assert items2[0].example == "test example cache hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    row_id = await conn.fetchval("""
        INSERT INTO examples_resource (example) VALUES ('test example bypass')
        RETURNING id
    """)

    items = await get_examples(conn, [row_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/examples/get", {"ids": [str(row_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
