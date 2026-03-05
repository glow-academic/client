"""Tests for search_resolves."""

from datetime import datetime, timedelta, UTC

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.problems.create import create_problem
from app.routes.v5.tools.entries.resolves.create import create_resolve
from app.routes.v5.tools.entries.resolves.refresh import refresh_resolves
from app.routes.v5.tools.entries.resolves.search import search_resolves
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _call(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    return session, call


async def _problem(conn, session, call):
    result = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug"
    )
    return result.id


async def test_finds_created_resolve(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    result = await create_resolve(
        conn, problem_id=problem_id, resolved=False, call_id=call.id
    )
    await refresh_resolves(conn)

    items = await search_resolves(conn, problem_id=problem_id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_problem_id(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    await create_resolve(conn, problem_id=problem_id, resolved=False, call_id=call.id)
    await refresh_resolves(conn)

    items = await search_resolves(conn, problem_id=nonexistent_id())

    assert items == []


async def test_filters_by_resolved(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    r_resolved = await create_resolve(
        conn, problem_id=problem_id, resolved=True, call_id=call.id
    )
    r_unresolved = await create_resolve(
        conn, problem_id=problem_id, resolved=False, call_id=call.id
    )
    await refresh_resolves(conn)

    items = await search_resolves(conn, resolved=True)

    ids = [item.id for item in items]
    assert r_resolved.id in ids
    assert r_unresolved.id not in ids


async def test_filters_by_mcp(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    r_mcp = await create_resolve(
        conn, problem_id=problem_id, resolved=False, call_id=call.id, mcp=True
    )
    r_normal = await create_resolve(
        conn, problem_id=problem_id, resolved=False, call_id=call.id, mcp=False
    )
    await refresh_resolves(conn)

    items = await search_resolves(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_filters_by_date_from(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    result = await create_resolve(
        conn, problem_id=problem_id, resolved=False, call_id=call.id
    )
    await refresh_resolves(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_resolves(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    result = await create_resolve(
        conn, problem_id=problem_id, resolved=False, call_id=call.id
    )
    await refresh_resolves(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_resolves(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_pagination_limit(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    await create_resolve(conn, problem_id=problem_id, resolved=False, call_id=call.id)
    await create_resolve(conn, problem_id=problem_id, resolved=True, call_id=call.id)
    await refresh_resolves(conn)

    items = await search_resolves(conn, problem_id=problem_id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    await create_resolve(conn, problem_id=problem_id, resolved=False, call_id=call.id)
    await refresh_resolves(conn)

    items = await search_resolves(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn):
    session, call = await _call(conn)
    problem_id = await _problem(conn, session, call)
    result = await create_resolve(
        conn, problem_id=problem_id, resolved=False, call_id=call.id
    )

    items = await search_resolves(conn, problem_id=problem_id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
