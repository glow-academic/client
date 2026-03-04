"""Tests for get_providers."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.providers.get import get_providers

pytestmark = pytest.mark.asyncio


async def test_gets_created_provider(conn, redis_client):
    provider_id = await conn.fetchval("""
        INSERT INTO providers_resource (name, description, value, endpoint)
        VALUES ('test-provider', 'Test provider desc', 'openai', 'https://api.openai.com')
        RETURNING id
    """)

    items = await get_providers(conn, [provider_id], redis_client)

    assert len(items) == 1
    assert items[0].id == provider_id
    assert items[0].name == "test-provider"
    assert items[0].description == "Test provider desc"
    assert items[0].value == "openai"
    assert items[0].endpoint == "https://api.openai.com"
    assert items[0].department_ids == []
    assert items[0].active is True


async def test_returns_empty_for_missing_provider(conn, redis_client):
    items = await get_providers(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_providers(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    provider_id = await conn.fetchval("""
        INSERT INTO providers_resource (name) VALUES ('test-provider-cache-hit')
        RETURNING id
    """)

    # First call populates cache
    items = await get_providers(conn, [provider_id], redis_client)
    assert len(items) == 1

    # Second call serves from cache
    items2 = await get_providers(conn, [provider_id], redis_client)
    assert len(items2) == 1
    assert items2[0].name == "test-provider-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    provider_id = await conn.fetchval("""
        INSERT INTO providers_resource (name) VALUES ('test-provider-bypass')
        RETURNING id
    """)

    items = await get_providers(conn, [provider_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/providers/get", {"ids": [str(provider_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
