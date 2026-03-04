"""Tests for get_parameter_fields."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.parameter_fields.get import get_parameter_fields

pytestmark = pytest.mark.asyncio


async def test_gets_created_parameter_field(conn, redis_client):
    field_id = await conn.fetchval("""
        INSERT INTO fields_resource (name, description, value)
        VALUES ('test-field', 'desc', 'val')
        RETURNING id
    """)

    row_id = await conn.fetchval("""
        INSERT INTO parameter_fields_resource (field_id)
        VALUES ($1)
        RETURNING id
    """, field_id)

    items = await get_parameter_fields(conn, [row_id], redis_client)

    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].field_id == field_id
    assert items[0].active is True


async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_parameter_fields(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_parameter_fields(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    field_id = await conn.fetchval("""
        INSERT INTO fields_resource (name, description, value)
        VALUES ('test-field', 'desc', 'val')
        RETURNING id
    """)

    row_id = await conn.fetchval("""
        INSERT INTO parameter_fields_resource (field_id)
        VALUES ($1)
        RETURNING id
    """, field_id)

    # First call populates cache
    items = await get_parameter_fields(conn, [row_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_parameter_fields(conn, [row_id], redis_client)
    assert len(items2) == 1
    assert items2[0].id == row_id


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    field_id = await conn.fetchval("""
        INSERT INTO fields_resource (name, description, value)
        VALUES ('test-field', 'desc', 'val')
        RETURNING id
    """)

    row_id = await conn.fetchval("""
        INSERT INTO parameter_fields_resource (field_id)
        VALUES ($1)
        RETURNING id
    """, field_id)

    items = await get_parameter_fields(conn, [row_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/parameter_fields/get", {"ids": [str(row_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
