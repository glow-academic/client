"""Tests for search_grants."""

import pytest

from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.grants.search import search_grants
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    result = await create_grant(conn, session_id=session.id)
    return result, session


async def test_finds_created_entry(conn, profile_id):
    result, session = await _setup(conn, profile_id)

    items = await search_grants(conn, grant_session_id=session.id, bypass_mv=True)

    ids = [item.grant_id for item in items]
    assert result.id in ids


async def test_filters_by_session_id(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_grants(conn, grant_session_id=nonexistent_id(), bypass_mv=True)

    assert items == []


async def test_pagination_limit(conn, profile_id):
    result, session = await _setup(conn, profile_id)

    items = await search_grants(
        conn, grant_session_id=session.id, limit=1, bypass_mv=True
    )

    assert len(items) <= 1


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_grants(conn, bypass_mv=True)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    result, session = await _setup(conn, profile_id)

    items = await search_grants(conn, grant_session_id=session.id, bypass_mv=True)

    ids = [item.grant_id for item in items]
    assert result.id in ids
