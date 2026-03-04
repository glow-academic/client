"""Tests for get_conditional_parameters."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.conditional_parameters.get import get_conditional_parameters

pytestmark = pytest.mark.asyncio


async def test_gets_created_conditional_parameter(conn, redis_client):
    parameter_id = await conn.fetchval(
        "INSERT INTO parameters_resource (name, description) VALUES ('test-param', 'desc') RETURNING id"
    )
    row_id = await conn.fetchval("""
        INSERT INTO conditional_parameters_resource (parameter_id)
        VALUES ($1)
        RETURNING id
    """, parameter_id)

    items = await get_conditional_parameters(conn, [row_id], redis_client)

    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].parameter_id == parameter_id
    assert items[0].active is True


async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_conditional_parameters(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_conditional_parameters(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    parameter_id = await conn.fetchval(
        "INSERT INTO parameters_resource (name, description) VALUES ('test-param', 'desc') RETURNING id"
    )
    row_id = await conn.fetchval("""
        INSERT INTO conditional_parameters_resource (parameter_id)
        VALUES ($1)
        RETURNING id
    """, parameter_id)

    # First call populates cache
    items = await get_conditional_parameters(conn, [row_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_conditional_parameters(conn, [row_id], redis_client)
    assert len(items2) == 1
    assert items2[0].id == row_id


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    parameter_id = await conn.fetchval(
        "INSERT INTO parameters_resource (name, description) VALUES ('test-param', 'desc') RETURNING id"
    )
    row_id = await conn.fetchval("""
        INSERT INTO conditional_parameters_resource (parameter_id)
        VALUES ($1)
        RETURNING id
    """, parameter_id)

    items = await get_conditional_parameters(conn, [row_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/conditional_parameters/get", {"ids": [str(row_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
