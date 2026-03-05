"""Tests for get_debug_info."""


import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.debug_info.create import create_debug_info
from app.routes.v5.tools.entries.debug_info.get import get_debug_info
from app.routes.v5.tools.entries.debug_info.refresh import refresh_debug_info
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _call(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    return run, call


async def test_returns_by_id(conn, profile_id):
    run, call = await _call(conn, profile_id)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await get_debug_info(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].call_id == call.id
    assert items[0].active is True
    assert items[0].created_at is not None


async def test_returns_multiple(conn, profile_id):
    run, call = await _call(conn, profile_id)
    r1 = await create_debug_info(
        conn, call_id=call.id, content="debug output 1", run_id=run.id
    )
    r2 = await create_debug_info(
        conn, call_id=call.id, content="debug output 2", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await get_debug_info(conn, [r1.id, r2.id])

    assert len(items) == 2
    ids = {item.id for item in items}
    assert r1.id in ids
    assert r2.id in ids


async def test_returns_empty_for_missing(conn, profile_id):
    items = await get_debug_info(conn, [nonexistent_id()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn, profile_id):
    items = await get_debug_info(conn, [])

    assert items == []


async def test_bypass_mv(conn, profile_id):
    run, call = await _call(conn, profile_id)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )

    items = await get_debug_info(conn, [result.id], bypass_mv=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].call_id == call.id
