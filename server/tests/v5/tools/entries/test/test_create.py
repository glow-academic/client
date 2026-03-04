"""Tests for create_test."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test.get import get_tests
from app.routes.v5.tools.entries.test.refresh import refresh_test
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _test(conn, **overrides):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    defaults = dict(
        call_id=call.id,
        profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    defaults.update(overrides)
    result = await create_test(conn, **defaults)
    return result


async def test_returns_id(conn):
    result = await _test(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _test(conn)
    await refresh_test(conn)

    items = await get_tests(conn, [result.id])

    assert len(items) == 1
    assert items[0].test_id == result.id
    assert items[0].profile_id == SUPERADMIN_PROFILES_RESOURCE_ID


async def test_passes_mcp_flag(conn):
    result = await _test(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM test_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
