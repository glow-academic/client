"""Tests for get_names."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.names.get import get_names

pytestmark = pytest.mark.asyncio


async def test_gets_created_name(conn):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-for-get')
        RETURNING id
    """)

    items = await get_names(conn, [name_id])

    assert len(items) == 1
    assert items[0].id == name_id
    assert items[0].name == "test-name-for-get"
    assert items[0].active is True


async def test_returns_empty_for_missing_name(conn):
    items = await get_names(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_names(conn, [])

    assert items == []


async def test_cache_hit_skips_db(conn):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-cache-hit')
        RETURNING id
    """)
    cached_items = [{"id": str(name_id), "name": "cached_name", "created_at": "2024-01-01T00:00:00Z", "active": True, "mcp": False, "generated": False}]

    async def mock_get(key):
        return {"items": cached_items}

    async def mock_set(key, data, ttl, tags):
        pass

    items = await get_names(conn, [name_id], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].name == "cached_name"


async def test_cache_miss_calls_set(conn):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-cache-miss')
        RETURNING id
    """)
    stored = {}

    async def mock_get(key):
        return None

    async def mock_set(key, data, ttl, tags):
        stored["data"] = data
        stored["ttl"] = ttl
        stored["tags"] = list(tags)

    items = await get_names(conn, [name_id], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].name == "test-name-cache-miss"
    assert stored["ttl"] == 60
    assert stored["tags"] == ["resources", "names"]
    assert len(stored["data"]["items"]) == 1
