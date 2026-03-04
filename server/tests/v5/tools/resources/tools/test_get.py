"""Tests for get_tool."""

import pytest

from app.routes.v5.tools.resources.tools.get import get_tool
from tests.seed_ids import USE_VOICES_TOOL_ID

pytestmark = pytest.mark.asyncio


async def test_gets_existing_tool(conn):
    tool = await get_tool(conn, USE_VOICES_TOOL_ID)

    assert tool is not None
    assert tool.id == USE_VOICES_TOOL_ID
    assert tool.name == "use_voices"
    assert tool.active is True


async def test_returns_none_for_missing_tool(conn):
    from uuid import uuid4

    tool = await get_tool(conn, uuid4())

    assert tool is None
