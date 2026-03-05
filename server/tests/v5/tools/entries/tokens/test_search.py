"""Tests for search_tokens."""

from datetime import UTC, datetime, timedelta

import pytest

from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.tokens.create import create_token
from app.routes.v5.tools.entries.tokens.refresh import refresh_tokens
from app.routes.v5.tools.entries.tokens.search import search_tokens
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _run(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, session_id=session.id, group_id=group.id)
    return session, run


async def test_finds_created_token(conn):
    session, run = await _run(conn)
    result = await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    items = await search_tokens(conn, run_id=run.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_run_id(conn):
    session, run = await _run(conn)
    await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    items = await search_tokens(conn, run_id=nonexistent_id())

    assert items == []


async def test_filters_by_session_id(conn):
    session, run = await _run(conn)
    result = await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    items = await search_tokens(conn, session_id=session.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_session_id_no_match(conn):
    session, run = await _run(conn)
    await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    items = await search_tokens(conn, session_id=nonexistent_id())

    assert items == []


async def test_filters_by_date_from(conn):
    session, run = await _run(conn)
    result = await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_tokens(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    session, run = await _run(conn)
    result = await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_tokens(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_mcp(conn):
    session, run = await _run(conn)
    r_mcp = await create_token(conn, run_id=run.id, session_id=session.id, mcp=True)
    r_normal = await create_token(conn, run_id=run.id, session_id=session.id, mcp=False)
    await refresh_tokens(conn)

    items = await search_tokens(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_pagination_limit(conn):
    session, run = await _run(conn)
    await create_token(conn, run_id=run.id, session_id=session.id)
    await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    items = await search_tokens(conn, run_id=run.id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    session, run = await _run(conn)
    await create_token(conn, run_id=run.id, session_id=session.id)
    await refresh_tokens(conn)

    items = await search_tokens(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn):
    session, run = await _run(conn)
    result = await create_token(conn, run_id=run.id, session_id=session.id)

    items = await search_tokens(conn, run_id=run.id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
