"""Tests for refresh_debug_info."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.debug_info.create import create_debug_info
from app.routes.v5.tools.entries.debug_info.get import get_debug_info
from app.routes.v5.tools.entries.debug_info.refresh import refresh_debug_info
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _call(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    return run, call


async def test_appears_after_refresh(conn):
    run, call = await _call(conn)
    result = await create_debug_info(conn, call_id=call.id, content="debug output", run_id=run.id)
    await refresh_debug_info(conn)

    items = await get_debug_info(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_not_visible_before_refresh(conn):
    run, call = await _call(conn)
    result = await create_debug_info(conn, call_id=call.id, content="debug output", run_id=run.id)

    items = await get_debug_info(conn, [result.id])

    assert items == []
