"""Tests for create_test_invocation_groups."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test_invocation.create import create_test_invocation
from app.routes.v5.tools.entries.test_invocation_groups.create import (
    create_test_invocation_groups,
)
from app.routes.v5.tools.entries.test_invocation_groups.get import (
    get_test_invocation_groups,
)
from app.routes.v5.tools.entries.test_invocation_groups.refresh import (
    refresh_test_invocation_groups,
)
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _test_invocation_groups(conn, **overrides):
    """Create full chain: session → group → run → call → test → invocation → invocation_groups."""
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    test = await create_test(
        conn, call_id=call.id, profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID
    )
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    invocation = await create_test_invocation(
        conn, test_id=test.id, call_id=call2.id
    )
    defaults = dict(test_invocation_id=invocation.id)
    defaults.update(overrides)
    return await create_test_invocation_groups(conn, **defaults)


async def test_returns_id(conn):
    result = await _test_invocation_groups(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _test_invocation_groups(conn)

    await refresh_test_invocation_groups(conn)
    items = await get_test_invocation_groups(conn, [result.id])
    assert len(items) == 1


async def test_passes_mcp_flag(conn):
    result = await _test_invocation_groups(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM test_invocation_groups_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
