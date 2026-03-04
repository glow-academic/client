"""Tests for search_problems."""

from datetime import datetime, timedelta, UTC
from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.problems.create import create_problem
from app.routes.v5.tools.entries.problems.refresh import refresh_problems
from app.routes.v5.tools.entries.problems.search import search_problems
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _call(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    return session, call


async def test_finds_created_problem(conn):
    session, call = await _call(conn)
    result = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug"
    )
    await refresh_problems(conn)

    items = await search_problems(conn, session_id=session.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_session(conn):
    session, call = await _call(conn)
    await create_problem(conn, session_id=session.id, call_id=call.id, type="bug")
    await refresh_problems(conn)

    items = await search_problems(conn, session_id=uuid4())

    assert items == []


async def test_filters_by_profile(conn):
    session, call = await _call(conn)
    result = await create_problem(
        conn,
        session_id=session.id,
        call_id=call.id,
        type="bug",
        profile_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    await refresh_problems(conn)

    items = await search_problems(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_type(conn):
    session, call = await _call(conn)
    r_bug = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug"
    )
    r_feature = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="feature"
    )
    await refresh_problems(conn)

    items = await search_problems(conn, type="bug")

    ids = [item.id for item in items]
    assert r_bug.id in ids
    assert r_feature.id not in ids


async def test_filters_by_date_from(conn):
    session, call = await _call(conn)
    result = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug"
    )
    await refresh_problems(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_problems(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    session, call = await _call(conn)
    result = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug"
    )
    await refresh_problems(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_problems(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_mcp(conn):
    session, call = await _call(conn)
    r_mcp = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug", mcp=True
    )
    r_normal = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug", mcp=False
    )
    await refresh_problems(conn)

    items = await search_problems(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_pagination_limit(conn):
    session, call = await _call(conn)
    await create_problem(conn, session_id=session.id, call_id=call.id, type="bug")
    await create_problem(conn, session_id=session.id, call_id=call.id, type="feature")
    await refresh_problems(conn)

    items = await search_problems(conn, session_id=session.id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    session, call = await _call(conn)
    await create_problem(conn, session_id=session.id, call_id=call.id, type="bug")
    await refresh_problems(conn)

    items = await search_problems(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn):
    session, call = await _call(conn)
    result = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="question"
    )

    items = await search_problems(conn, session_id=session.id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
