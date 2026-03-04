"""Tests for get_problems."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.problems.create import create_problem
from app.routes.v5.tools.entries.problems.get import get_problems
from app.routes.v5.tools.entries.problems.refresh import refresh_problems
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


async def test_returns_problem_by_id(conn):
    session, call = await _call(conn)
    result = await create_problem(conn, session_id=session.id, call_id=call.id, type="bug")
    await refresh_problems(conn)

    items = await get_problems(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].session_id == session.id
    assert items[0].type == "bug"
    assert items[0].active is True
    assert items[0].created_at is not None


async def test_returns_multiple(conn):
    session, call = await _call(conn)
    r1 = await create_problem(conn, session_id=session.id, call_id=call.id, type="bug")
    r2 = await create_problem(conn, session_id=session.id, call_id=call.id, type="feature")
    await refresh_problems(conn)

    items = await get_problems(conn, [r1.id, r2.id])

    assert len(items) == 2
    ids = {item.id for item in items}
    assert r1.id in ids
    assert r2.id in ids


async def test_returns_empty_for_missing(conn):
    items = await get_problems(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_problems(conn, [])

    assert items == []


async def test_bypass_mv_returns_without_refresh(conn):
    session, call = await _call(conn)
    result = await create_problem(conn, session_id=session.id, call_id=call.id, type="other")

    items = await get_problems(conn, [result.id], bypass_mv=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].session_id == session.id
    assert items[0].type == "other"
