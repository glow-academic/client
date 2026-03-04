"""Tests for create_setting."""

import pytest

from app.routes.v5.tools.resources.settings.create import create_setting
from app.routes.v5.tools.resources.settings.get import get_settings

pytestmark = pytest.mark.asyncio


async def test_creates_new_setting(conn, redis_client):
    result = await create_setting(conn, "test-setting", "desc", redis_client)

    assert result.name == "test-setting"
    assert result.description == "desc"
    assert result.active is True
    assert result.mcp is False


async def test_visible_via_get(conn, redis_client):
    result = await create_setting(conn, "test-setting-visible", redis=redis_client)

    items = await get_settings(conn, [result.id], redis_client, bypass_cache=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].name == "test-setting-visible"


async def test_two_creates_produce_different_ids(conn, redis_client):
    first = await create_setting(conn, "test-setting-dup", redis=redis_client)
    second = await create_setting(conn, "test-setting-dup", redis=redis_client)

    assert first.id != second.id


async def test_sets_mcp_flag(conn, redis_client):
    result = await create_setting(conn, "mcp-setting", redis=redis_client, mcp=True)

    assert result.mcp is True
    assert result.generated is True
