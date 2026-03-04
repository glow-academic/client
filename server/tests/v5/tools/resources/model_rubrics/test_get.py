"""Tests for get_model_rubrics."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.model_rubrics.get import get_model_rubrics

pytestmark = pytest.mark.asyncio


async def test_gets_created_model_rubric(conn, redis_client):
    model_id = await conn.fetchval("INSERT INTO models_resource DEFAULT VALUES RETURNING id")
    rubric_id = await conn.fetchval("""
        INSERT INTO rubrics_resource (name, description)
        VALUES ('test-rubric', 'desc')
        RETURNING id
    """)
    row_id = await conn.fetchval("""
        INSERT INTO model_rubrics_resource (model_id, rubric_id)
        VALUES ($1, $2)
        RETURNING id
    """, model_id, rubric_id)

    items = await get_model_rubrics(conn, [row_id], redis_client)

    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].model_id == model_id
    assert items[0].rubric_id == rubric_id
    assert items[0].active is True


async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_model_rubrics(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_model_rubrics(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    model_id = await conn.fetchval("INSERT INTO models_resource DEFAULT VALUES RETURNING id")
    rubric_id = await conn.fetchval("""
        INSERT INTO rubrics_resource (name, description)
        VALUES ('test-rubric', 'desc')
        RETURNING id
    """)
    row_id = await conn.fetchval("""
        INSERT INTO model_rubrics_resource (model_id, rubric_id)
        VALUES ($1, $2)
        RETURNING id
    """, model_id, rubric_id)

    # First call populates cache
    items = await get_model_rubrics(conn, [row_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_model_rubrics(conn, [row_id], redis_client)
    assert len(items2) == 1
    assert items2[0].id == row_id


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    model_id = await conn.fetchval("INSERT INTO models_resource DEFAULT VALUES RETURNING id")
    rubric_id = await conn.fetchval("""
        INSERT INTO rubrics_resource (name, description)
        VALUES ('test-rubric', 'desc')
        RETURNING id
    """)
    row_id = await conn.fetchval("""
        INSERT INTO model_rubrics_resource (model_id, rubric_id)
        VALUES ($1, $2)
        RETURNING id
    """, model_id, rubric_id)

    items = await get_model_rubrics(conn, [row_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/model_rubrics/get", {"ids": [str(row_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
