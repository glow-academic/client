"""Tests for refresh_logins."""

import pytest

from app.routes.v5.tools.entries.logins.create import create_login
from app.routes.v5.tools.entries.logins.get import get_logins
from app.routes.v5.tools.entries.logins.refresh import refresh_logins
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_new_login_appears_after_refresh(conn):
    session = await _session(conn)
    result = await create_login(conn, session_id=session.id)
    await refresh_logins(conn)

    items = await get_logins(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_new_login_not_visible_before_refresh(conn):
    session = await _session(conn)
    result = await create_login(conn, session_id=session.id)

    items = await get_logins(conn, [result.id])

    assert items == []
