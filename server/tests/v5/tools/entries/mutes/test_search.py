"""Tests for search_mutes."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.mutes.create import create_mute
from app.routes.v5.tools.entries.mutes.refresh import refresh_mutes
from app.routes.v5.tools.entries.mutes.search import search_mutes
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


async def test_finds_created_mute(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await search_mutes(conn, conversation_id=conv_id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_conversation_id(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await search_mutes(conn, conversation_id=uuid4())

    assert items == []


async def test_filters_by_muted_true(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    r_muted = await create_mute(conn, conversation_id=conv_id, muted=True)
    r_unmuted = await create_mute(conn, conversation_id=conv_id, muted=False)
    await refresh_mutes(conn)

    items = await search_mutes(conn, muted=True)

    ids = [item.id for item in items]
    assert r_muted.id in ids
    assert r_unmuted.id not in ids


async def test_filters_by_muted_false(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    r_muted = await create_mute(conn, conversation_id=conv_id, muted=True)
    r_unmuted = await create_mute(conn, conversation_id=conv_id, muted=False)
    await refresh_mutes(conn)

    items = await search_mutes(conn, muted=False)

    ids = [item.id for item in items]
    assert r_unmuted.id in ids
    assert r_muted.id not in ids


async def test_filters_by_date_from(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_mutes(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_mutes(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_mcp(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    r_mcp = await create_mute(conn, conversation_id=conv_id, mcp=True)
    r_normal = await create_mute(conn, conversation_id=conv_id, mcp=False)
    await refresh_mutes(conn)

    items = await search_mutes(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_pagination_limit(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    await create_mute(conn, conversation_id=conv_id)
    await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await search_mutes(conn, conversation_id=conv_id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    await create_mute(conn, conversation_id=conv_id)
    await refresh_mutes(conn)

    items = await search_mutes(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn):
    session = await _session(conn)
    conv_id = await _conversation(conn, session.id)
    result = await create_mute(conn, conversation_id=conv_id)

    items = await search_mutes(conn, conversation_id=conv_id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
