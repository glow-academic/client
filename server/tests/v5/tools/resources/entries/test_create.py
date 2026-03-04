"""Tests for create_entry."""

import pytest

from app.routes.v5.tools.resources.entries.create import create_entry
from app.routes.v5.tools.resources.entries.get import get_entries

pytestmark = pytest.mark.asyncio


async def test_creates_new_entry(conn, redis_client):
    result = await create_entry(conn, "activity", redis_client)

    assert result.entry == "activity"
    assert result.active is True
    assert result.mcp is False


async def test_visible_via_get(conn, redis_client):
    result = await create_entry(conn, "calls", redis_client)

    items = await get_entries(conn, [result.id], redis_client, bypass_cache=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].entry == "calls"


async def test_returns_existing_on_conflict(conn, redis_client):
    first = await create_entry(conn, "domains", redis_client)
    second = await create_entry(conn, "domains", redis_client)

    assert first.id == second.id
    assert second.entry == "domains"


async def test_sets_mcp_flag(conn, redis_client):
    result = await create_entry(conn, "audits", redis_client, mcp=True)

    assert result.mcp is True
    assert result.generated is True
