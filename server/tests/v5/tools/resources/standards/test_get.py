"""Tests for get_standards."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.standards.get import get_standards

pytestmark = pytest.mark.asyncio


async def test_gets_created_standard(conn, redis_client):
    standard_group_id = await conn.fetchval("""
        INSERT INTO standard_groups_resource (name, short_name, description, points, pass_points)
        VALUES ('Test Group', 'TG', 'desc', 100, 70)
        RETURNING id
    """)
    row_id = await conn.fetchval("""
        INSERT INTO standards_resource (name, description, points, standard_group_id)
        VALUES ('Test Standard', 'desc', 10, $1)
        RETURNING id
    """, standard_group_id)

    items = await get_standards(conn, [row_id], redis_client)

    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].name == "Test Standard"
    assert items[0].description == "desc"
    assert items[0].points == 10
    assert items[0].standard_group_id == standard_group_id
    assert items[0].active is True


async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_standards(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_standards(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    standard_group_id = await conn.fetchval("""
        INSERT INTO standard_groups_resource (name, short_name, description, points, pass_points)
        VALUES ('Test Group', 'TG', 'desc', 100, 70)
        RETURNING id
    """)
    row_id = await conn.fetchval("""
        INSERT INTO standards_resource (name, description, points, standard_group_id)
        VALUES ('Test Standard', 'desc', 10, $1)
        RETURNING id
    """, standard_group_id)

    # First call populates cache
    items = await get_standards(conn, [row_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_standards(conn, [row_id], redis_client)
    assert len(items2) == 1
    assert items2[0].id == row_id


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    standard_group_id = await conn.fetchval("""
        INSERT INTO standard_groups_resource (name, short_name, description, points, pass_points)
        VALUES ('Test Group', 'TG', 'desc', 100, 70)
        RETURNING id
    """)
    row_id = await conn.fetchval("""
        INSERT INTO standards_resource (name, description, points, standard_group_id)
        VALUES ('Test Standard', 'desc', 10, $1)
        RETURNING id
    """, standard_group_id)

    items = await get_standards(conn, [row_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/standards/get", {"ids": [str(row_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
