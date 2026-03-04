"""Tests for refresh_problems."""

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


async def test_new_problem_appears_after_refresh(conn):
    session, call = await _call(conn)
    result = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug"
    )
    await refresh_problems(conn)

    items = await get_problems(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_new_problem_not_visible_before_refresh(conn):
    session, call = await _call(conn)
    result = await create_problem(
        conn, session_id=session.id, call_id=call.id, type="bug"
    )

    items = await get_problems(conn, [result.id])

    assert items == []
