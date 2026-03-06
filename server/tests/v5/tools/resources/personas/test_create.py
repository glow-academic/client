"""Tests for create_persona."""

import pytest

from app.routes.v5.tools.resources.personas.create import create_persona
from app.routes.v5.tools.resources.personas.get import get_personas

pytestmark = pytest.mark.asyncio


async def test_creates_new_persona(conn, redis_client):
    result = await create_persona(
        conn, redis_client, name="test-persona", description="desc"
    )

    assert result.name == "test-persona"
    assert result.description == "desc"
    assert result.active is True
    assert result.mcp is False


async def test_visible_via_get(conn, redis_client):
    result = await create_persona(conn, redis_client, name="test-persona-visible")

    items = await get_personas(conn, [result.id], redis_client, bypass_cache=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].name == "test-persona-visible"


async def test_creates_second_row_with_same_name(conn, redis_client):
    first = await create_persona(conn, redis_client, name="duplicate-persona")
    second = await create_persona(conn, redis_client, name="duplicate-persona")

    assert first.id != second.id
    assert second.name == "duplicate-persona"


async def test_sets_mcp_flag(conn, redis_client):
    result = await create_persona(conn, redis_client, name="mcp-persona", mcp=True)

    assert result.mcp is True
    assert result.generated is True
