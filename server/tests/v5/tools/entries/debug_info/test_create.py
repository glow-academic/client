"""Tests for create_debug_info."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.debug_info.create import create_debug_info
from app.routes.v5.tools.entries.debug_info.get import get_debug_info
from app.routes.v5.tools.entries.debug_info.refresh import refresh_debug_info
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session

pytestmark = pytest.mark.asyncio


async def _call(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    return session, run, call


async def test_returns_id(conn, profile_id):
    _, run, call = await _call(conn, profile_id)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn, profile_id):
    _, run, call = await _call(conn, profile_id)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await get_debug_info(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].call_id == call.id
    assert items[0].active is True
    assert items[0].mcp is False


async def test_passes_mcp_flag(conn, profile_id):
    _, run, call = await _call(conn, profile_id)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id, mcp=True
    )
    await refresh_debug_info(conn)

    items = await get_debug_info(conn, [result.id])

    assert len(items) == 1
    assert items[0].mcp is True


async def test_passes_content(conn, profile_id):
    _, run, call = await _call(conn, profile_id)
    result = await create_debug_info(
        conn, call_id=call.id, content="specific debug content", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await get_debug_info(conn, [result.id])

    assert len(items) == 1
    assert items[0].content == "specific debug content"


async def test_passes_run_id(conn, profile_id):
    _, run, call = await _call(conn, profile_id)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await get_debug_info(conn, [result.id])

    assert len(items) == 1
    assert items[0].run_id == run.id
