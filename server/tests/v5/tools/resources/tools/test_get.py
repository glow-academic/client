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
