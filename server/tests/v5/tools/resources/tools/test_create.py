"""Tests for create_tool."""

import pytest

from app.routes.v5.tools.resources.tools.create import create_tool
from app.routes.v5.tools.resources.tools.get import get_tools

pytestmark = pytest.mark.asyncio


async def test_creates_new_tool(conn, redis_client):
    result = await create_tool(conn, "test-tool", "desc", redis_client)

    assert result.name == "test-tool"
    assert result.description == "desc"
    assert result.active is True
    assert result.mcp is False


async def test_visible_via_get(conn, redis_client):
    result = await create_tool(conn, "test-tool-visible", redis=redis_client)

    items = await get_tools(conn, [result.id], redis_client, bypass_cache=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].name == "test-tool-visible"


async def test_two_creates_produce_different_ids(conn, redis_client):
    first = await create_tool(conn, "test-tool-dup", redis=redis_client)
    second = await create_tool(conn, "test-tool-dup", redis=redis_client)

    assert first.id != second.id


async def test_sets_mcp_flag(conn, redis_client):
    result = await create_tool(conn, "mcp-tool", redis=redis_client, mcp=True)

    assert result.mcp is True
    assert result.generated is True
