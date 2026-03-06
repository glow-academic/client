"""Tests for create_test_stop."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test_invocation.create import create_test_invocation
from app.routes.v5.tools.entries.test_stop.create import create_test_stop
from app.routes.v5.tools.entries.test_stop.get import get_test_stops
from app.routes.v5.tools.entries.test_stop.refresh import refresh_test_stop

pytestmark = pytest.mark.asyncio


async def _test_stop(conn, profile_id, **overrides):
    session = await create_session(conn, profile_id=profile_id)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    test = await create_test(conn, call_id=call.id, profiles_id=profile_id)
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    test_invocation = await create_test_invocation(
        conn, test_id=test.id, call_id=call2.id
    )
    defaults = dict(
        invocation_id=test_invocation.id,
        call_id=call2.id,
        stopped=True,
    )
    defaults.update(overrides)
    return await create_test_stop(conn, **defaults)


async def test_returns_id(conn, profile_id):
    result = await _test_stop(conn, profile_id)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn, profile_id):
    result = await _test_stop(conn, profile_id)
    await refresh_test_stop(conn)

    items = await get_test_stops(conn, [result.id])

    assert len(items) == 1


async def test_passes_mcp_flag(conn, profile_id):
    result = await _test_stop(conn, profile_id, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM test_stop_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
