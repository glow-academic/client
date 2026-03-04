"""Tests for get_profile_personas."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.profile_personas.get import get_profile_personas

pytestmark = pytest.mark.asyncio


async def test_gets_created_profile_persona(conn, redis_client):
    profile_id = await conn.fetchval("INSERT INTO profiles_resource DEFAULT VALUES RETURNING id")
    persona_id = await conn.fetchval(
        "INSERT INTO personas_resource (name, description) VALUES ('test-persona', 'desc') RETURNING id"
    )
    row_id = await conn.fetchval("""
        INSERT INTO profile_personas_resource (profile_id, persona_id)
        VALUES ($1, $2)
        RETURNING id
    """, profile_id, persona_id)

    items = await get_profile_personas(conn, [row_id], redis_client)

    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].profile_id == profile_id
    assert items[0].persona_id == persona_id
    assert items[0].active is True


async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_profile_personas(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_profile_personas(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    profile_id = await conn.fetchval("INSERT INTO profiles_resource DEFAULT VALUES RETURNING id")
    persona_id = await conn.fetchval(
        "INSERT INTO personas_resource (name, description) VALUES ('test-persona', 'desc') RETURNING id"
    )
    row_id = await conn.fetchval("""
        INSERT INTO profile_personas_resource (profile_id, persona_id)
        VALUES ($1, $2)
        RETURNING id
    """, profile_id, persona_id)

    # First call populates cache
    items = await get_profile_personas(conn, [row_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_profile_personas(conn, [row_id], redis_client)
    assert len(items2) == 1
    assert items2[0].id == row_id


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    profile_id = await conn.fetchval("INSERT INTO profiles_resource DEFAULT VALUES RETURNING id")
    persona_id = await conn.fetchval(
        "INSERT INTO personas_resource (name, description) VALUES ('test-persona', 'desc') RETURNING id"
    )
    row_id = await conn.fetchval("""
        INSERT INTO profile_personas_resource (profile_id, persona_id)
        VALUES ($1, $2)
        RETURNING id
    """, profile_id, persona_id)

    items = await get_profile_personas(conn, [row_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/profile_personas/get", {"ids": [str(row_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
