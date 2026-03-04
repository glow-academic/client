"""Tests for get_tools."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.tools.get import get_tools
from tests.seed_ids import USE_VOICES_TOOL_ID

pytestmark = pytest.mark.asyncio


async def test_gets_existing_tool(conn):
    items = await get_tools(conn, [USE_VOICES_TOOL_ID])

    assert len(items) == 1
    assert items[0].id == USE_VOICES_TOOL_ID
    assert items[0].name == "use_voices"
    assert items[0].active is True


async def test_returns_empty_for_missing_tool(conn):
    items = await get_tools(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_tools(conn, [])

    assert items == []


async def test_cache_hit_skips_db(conn):
    cached_items = [{"id": str(USE_VOICES_TOOL_ID), "name": "cached_tool", "description": None, "operation": None, "department_ids": [], "args_ids": [], "args_output_ids": [], "resources": [], "entries": [], "artifacts": [], "created_at": "2024-01-01T00:00:00Z", "active": True, "mcp": False, "generated": False}]

    async def mock_get(key):
        return {"items": cached_items}

    async def mock_set(key, data, ttl, tags):
        pass

    items = await get_tools(conn, [USE_VOICES_TOOL_ID], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].name == "cached_tool"


async def test_cache_miss_calls_set(conn):
    stored = {}

    async def mock_get(key):
        return None

    async def mock_set(key, data, ttl, tags):
        stored["data"] = data
        stored["ttl"] = ttl
        stored["tags"] = list(tags)

    items = await get_tools(conn, [USE_VOICES_TOOL_ID], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].id == USE_VOICES_TOOL_ID
    assert stored["ttl"] == 60
    assert stored["tags"] == ["resources", "tools"]
    assert len(stored["data"]["items"]) == 1
