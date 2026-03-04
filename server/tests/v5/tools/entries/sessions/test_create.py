"""Tests for create_session."""

import pytest

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.sessions.get import get_sessions
from app.routes.v5.tools.entries.sessions.refresh import refresh_sessions
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_returns_id(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await refresh_sessions(conn)

    items = await get_sessions(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].profile_id == SUPERADMIN_PROFILES_RESOURCE_ID
    assert items[0].active is True
    assert items[0].mcp is False


async def test_passes_mcp_flag(conn):
    result = await create_session(
        conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID, mcp=True,
    )
    await refresh_sessions(conn)

    items = await get_sessions(conn, [result.id])

    assert len(items) == 1
    assert items[0].mcp is True
