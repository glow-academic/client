"""Tests for refresh_sessions."""

import pytest

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.sessions.get import get_sessions
from app.routes.v5.tools.entries.sessions.refresh import refresh_sessions
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_new_session_appears_after_refresh(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    await refresh_sessions(conn)

    items = await get_sessions(conn, [result.id])
    assert len(items) == 1
    assert items[0].id == result.id


async def test_new_session_not_visible_before_refresh(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    items = await get_sessions(conn, [result.id])
    assert items == []
