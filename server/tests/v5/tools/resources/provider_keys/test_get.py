"""Tests for get_provider_keys."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.provider_keys.get import get_provider_keys

pytestmark = pytest.mark.asyncio


async def _insert_provider_key(conn, *, name="test-pk", key="sk-pk-123", description="Test pk desc"):
    """Helper to insert provider_keys_resource with required FK deps."""
    provider_id = await conn.fetchval("""
        INSERT INTO providers_resource (name) VALUES ('test-provider-for-pk')
        RETURNING id
    """)
    key_id = await conn.fetchval("""
        INSERT INTO keys_resource (key, name) VALUES ('sk-fk-dep', 'fk-dep-key')
        RETURNING id
    """)
    pk_id = await conn.fetchval("""
        INSERT INTO provider_keys_resource (provider_id, key_id, key, name, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    """, provider_id, key_id, key, name, description)
    return pk_id, provider_id, key_id


async def test_gets_created_provider_key(conn, redis_client):
    pk_id, provider_id, key_id = await _insert_provider_key(conn)

    items = await get_provider_keys(conn, [pk_id], redis_client)

    assert len(items) == 1
    assert items[0].id == pk_id
    assert items[0].provider_id == provider_id
    assert items[0].key_id == key_id
    assert items[0].key == "sk-pk-123"
    assert items[0].name == "test-pk"
    assert items[0].description == "Test pk desc"
    assert items[0].active is True


async def test_returns_empty_for_missing_provider_key(conn, redis_client):
    items = await get_provider_keys(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_provider_keys(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    pk_id, _, _ = await _insert_provider_key(conn, name="test-pk-cache-hit")

    # First call populates cache
    items = await get_provider_keys(conn, [pk_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_provider_keys(conn, [pk_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-pk-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    pk_id, _, _ = await _insert_provider_key(conn, name="test-pk-bypass")

    items = await get_provider_keys(conn, [pk_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/provider_keys/get", {"ids": [str(pk_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
