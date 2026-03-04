"""Tests for create_resource."""

import pytest

from app.routes.v5.tools.resources.resources.create import create_resource
from app.routes.v5.tools.resources.resources.get import get_resources

pytestmark = pytest.mark.asyncio


async def test_creates_new_resource(conn, redis_client):
    result = await create_resource(conn, "agents", redis_client)

    assert result.resource == "agents"
    assert result.active is True
    assert result.mcp is False


async def test_visible_via_get(conn, redis_client):
    result = await create_resource(conn, "names", redis_client)

    items = await get_resources(conn, [result.id], redis_client, bypass_cache=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].resource == "names"


async def test_returns_existing_on_conflict(conn, redis_client):
    first = await create_resource(conn, "emails", redis_client)
    second = await create_resource(conn, "emails", redis_client)

    assert first.id == second.id
    assert second.resource == "emails"


async def test_sets_mcp_flag(conn, redis_client):
    result = await create_resource(conn, "slugs", redis_client, mcp=True)

    assert result.mcp is True
    assert result.generated is True
