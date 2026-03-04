"""Tests for refresh_problems."""

import pytest

from app.routes.v5.tools.entries.problems.create import create_problem
from app.routes.v5.tools.entries.problems.get import get_problems
from app.routes.v5.tools.entries.problems.refresh import refresh_problems
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_new_problem_appears_after_refresh(conn):
    session = await _session(conn)
    result = await create_problem(conn, session_id=session.id, type="bug")
    await refresh_problems(conn)

    items = await get_problems(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_new_problem_not_visible_before_refresh(conn):
    session = await _session(conn)
    result = await create_problem(conn, session_id=session.id, type="bug")

    items = await get_problems(conn, [result.id])

    assert items == []
