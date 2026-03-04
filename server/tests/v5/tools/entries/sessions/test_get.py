"""Tests for get_sessions."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.sessions.get import get_sessions
from app.routes.v5.tools.entries.sessions.refresh import refresh_sessions
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_returns_session_by_id(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await refresh_sessions(conn)

    items = await get_sessions(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].profile_id == SUPERADMIN_PROFILES_RESOURCE_ID
    assert items[0].active is True
    assert items[0].created_at is not None


async def test_returns_multiple(conn):
    r1 = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    r2 = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await refresh_sessions(conn)

    items = await get_sessions(conn, [r1.id, r2.id])

    assert len(items) == 2
    ids = {item.id for item in items}
    assert r1.id in ids
    assert r2.id in ids


async def test_returns_empty_for_missing(conn):
    items = await get_sessions(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_sessions(conn, [])

    assert items == []


async def test_bypass_mv_returns_without_refresh(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    items = await get_sessions(conn, [result.id], bypass_mv=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].profile_id == SUPERADMIN_PROFILES_RESOURCE_ID
