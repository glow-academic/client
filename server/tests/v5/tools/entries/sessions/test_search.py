"""Tests for search_sessions."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.sessions.refresh import refresh_sessions
from app.routes.v5.tools.entries.sessions.search import search_sessions
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_finds_created_session(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await refresh_sessions(conn)

    items = await search_sessions(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_profile(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await refresh_sessions(conn)

    items = await search_sessions(conn, profile_id=uuid4())

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_pagination_limit(conn):
    await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await refresh_sessions(conn)

    items = await search_sessions(
        conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID, limit=1,
    )

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    await refresh_sessions(conn)

    items = await search_sessions(conn)

    assert len(items) >= 1
