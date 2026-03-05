"""Tests for search_groups."""

from datetime import datetime, timedelta, UTC

import pytest

from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.groups.refresh import refresh_groups
from app.routes.v5.tools.entries.groups.search import search_groups
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_finds_created_group(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id)
    await refresh_groups(conn)

    items = await search_groups(conn, session_id=session.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_session(conn):
    session = await _session(conn)
    await create_group(conn, session_id=session.id)
    await refresh_groups(conn)

    items = await search_groups(conn, session_id=nonexistent_id())

    assert items == []


async def test_filters_by_name(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id, name="unique-test-name")
    await refresh_groups(conn)

    items = await search_groups(conn, name="unique-test-name")

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_date_from(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id)
    await refresh_groups(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_groups(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id)
    await refresh_groups(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_groups(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_mcp(conn):
    session = await _session(conn)
    r_mcp = await create_group(conn, session_id=session.id, mcp=True)
    r_normal = await create_group(conn, session_id=session.id, mcp=False)
    await refresh_groups(conn)

    items = await search_groups(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_pagination_limit(conn):
    session = await _session(conn)
    await create_group(conn, session_id=session.id)
    await create_group(conn, session_id=session.id)
    await refresh_groups(conn)

    items = await search_groups(conn, session_id=session.id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    session = await _session(conn)
    await create_group(conn, session_id=session.id)
    await refresh_groups(conn)

    items = await search_groups(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id)

    items = await search_groups(conn, session_id=session.id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
