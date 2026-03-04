"""Tests for refresh_mutes."""

import pytest

from app.routes.v5.tools.entries.mutes.create import create_mute
from app.routes.v5.tools.entries.mutes.get import get_mutes
from app.routes.v5.tools.entries.mutes.refresh import refresh_mutes
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def _conversation(conn, session_id):
    return await conn.fetchval(
        "INSERT INTO conversations_entry (session_id, generated) VALUES ($1, true) RETURNING id",
        session_id,
    )


async def test_appears_after_refresh(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_not_visible_before_refresh(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)

    items = await get_mutes(conn, [result.id])

    assert items == []
