"""Tests for refresh_sessions."""

import pytest

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.sessions.refresh import refresh_sessions
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_new_session_appears_in_mv_after_refresh(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    await refresh_sessions(conn)

    row = await conn.fetchrow(
        "SELECT session_id, profile_id FROM sessions_mv WHERE session_id = $1",
        result.id,
    )
    assert row is not None
    assert row["session_id"] == result.id
    assert row["profile_id"] == SUPERADMIN_PROFILES_RESOURCE_ID


async def test_session_not_in_mv_before_refresh(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    row = await conn.fetchrow(
        "SELECT session_id FROM sessions_mv WHERE session_id = $1",
        result.id,
    )
    assert row is None
