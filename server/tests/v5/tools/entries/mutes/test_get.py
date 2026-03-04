"""Tests for get_mutes."""

from uuid import uuid4

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


async def test_returns_by_id(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].conversation_id == conv_id
    assert items[0].active is True
    assert items[0].created_at is not None


async def test_returns_multiple(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    r1 = await create_mute(conn, conversation_id=conv_id)
    r2 = await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await get_mutes(conn, [r1.id, r2.id])

    assert len(items) == 2
    ids = {item.id for item in items}
    assert r1.id in ids
    assert r2.id in ids


async def test_returns_empty_for_missing(conn):
    items = await get_mutes(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_mutes(conn, [])

    assert items == []


async def test_bypass_mv(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)

    items = await get_mutes(conn, [result.id], bypass_mv=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].conversation_id == conv_id
