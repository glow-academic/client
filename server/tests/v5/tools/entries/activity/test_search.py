"""Tests for search_activity."""

from datetime import datetime, timedelta, UTC
from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.activity.create import create_activity
from app.routes.v5.tools.entries.activity.refresh import refresh_activity
from app.routes.v5.tools.entries.activity.search import search_activity
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_finds_created_activity(conn):
    session = await _session(conn)
    result = await create_activity(conn, session_id=session.id)
    await refresh_activity(conn)

    items = await search_activity(conn, session_id=session.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_session(conn):
    session = await _session(conn)
    await create_activity(conn, session_id=session.id)
    await refresh_activity(conn)

    items = await search_activity(conn, session_id=uuid4())

    assert items == []


async def test_filters_by_profile(conn):
    session = await _session(conn)
    result = await create_activity(
        conn,
        session_id=session.id,
        profile_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    await refresh_activity(conn)

    items = await search_activity(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_date_from(conn):
    session = await _session(conn)
    result = await create_activity(conn, session_id=session.id)
    await refresh_activity(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_activity(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    session = await _session(conn)
    result = await create_activity(conn, session_id=session.id)
    await refresh_activity(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_activity(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_mcp(conn):
    session = await _session(conn)
    r_mcp = await create_activity(conn, session_id=session.id, mcp=True)
    r_normal = await create_activity(conn, session_id=session.id, mcp=False)
    await refresh_activity(conn)

    items = await search_activity(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_pagination_limit(conn):
    session = await _session(conn)
    await create_activity(conn, session_id=session.id)
    await create_activity(conn, session_id=session.id)
    await refresh_activity(conn)

    items = await search_activity(conn, session_id=session.id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    session = await _session(conn)
    await create_activity(conn, session_id=session.id)
    await refresh_activity(conn)

    items = await search_activity(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn):
    session = await _session(conn)
    result = await create_activity(conn, session_id=session.id)

    items = await search_activity(conn, session_id=session.id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
