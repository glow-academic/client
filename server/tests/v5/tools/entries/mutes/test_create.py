"""Tests for create_mute."""

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


async def test_returns_id(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].conversation_id == conv_id
    assert items[0].active is True
    assert items[0].mcp is False


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id, mcp=True)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [result.id])

    assert len(items) == 1
    assert items[0].mcp is True


async def test_stores_muted_true(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id, muted=True)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [result.id])

    assert len(items) == 1
    assert items[0].muted is True


async def test_stores_muted_false(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id, muted=False)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [result.id])

    assert len(items) == 1
    assert items[0].muted is False


async def test_call_id_nullable(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id, call_id=None)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [result.id])

    assert len(items) == 1
    assert items[0].call_id is None
