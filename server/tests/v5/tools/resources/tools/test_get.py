"""Tests for get_tools."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.tools.get import get_tools
from tests.seed_ids import USE_VOICES_TOOL_ID

pytestmark = pytest.mark.asyncio


async def test_gets_existing_tool(conn: object) -> None:
    redis = AsyncMock()
    items = await get_tools(conn, [USE_VOICES_TOOL_ID], redis)

    assert len(items) == 1
    assert items[0].id == USE_VOICES_TOOL_ID
    assert items[0].name == "use_voices"
    assert items[0].active is True


async def test_returns_empty_for_missing_tool(conn: object) -> None:
    redis = AsyncMock()
    items = await get_tools(conn, [uuid4()], redis)

    assert items == []


async def test_returns_empty_for_empty_ids(conn: object) -> None:
    redis = AsyncMock()
    items = await get_tools(conn, [], redis)

    assert items == []


async def test_cache_hit_skips_db(conn: object) -> None:
    cached_items = [{"id": str(USE_VOICES_TOOL_ID), "name": "cached_tool", "description": None, "operation": None, "department_ids": [], "args_ids": [], "args_output_ids": [], "resources": [], "entries": [], "artifacts": [], "created_at": "2024-01-01T00:00:00Z", "active": True, "mcp": False, "generated": False}]

    redis = AsyncMock()

    with patch("app.routes.v5.tools.resources.tools.get.get_cached", new_callable=AsyncMock, return_value={"items": cached_items}):
        items = await get_tools(conn, [USE_VOICES_TOOL_ID], redis)

    assert len(items) == 1
    assert items[0].name == "cached_tool"


async def test_cache_miss_calls_set(conn: object) -> None:
    redis = AsyncMock()

    mock_set = AsyncMock()
    with patch("app.routes.v5.tools.resources.tools.get.get_cached", new_callable=AsyncMock, return_value=None):
        with patch("app.routes.v5.tools.resources.tools.get.set_cached", mock_set):
            items = await get_tools(conn, [USE_VOICES_TOOL_ID], redis)

    assert len(items) == 1
    assert items[0].id == USE_VOICES_TOOL_ID
    mock_set.assert_called_once()
    call_args = mock_set.call_args
    assert call_args.kwargs["redis"] is redis
    assert "items" in call_args.args[1]
    assert call_args.args[2] == 60  # ttl
    assert list(call_args.args[3]) == ["resources", "tools"]  # tags
