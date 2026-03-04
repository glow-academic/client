"""Tests for refresh_test_invocation_bridge."""

import pytest

from app.routes.v5.tools.entries.benchmark.create import create_benchmark
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.invocation.create import create_invocation
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test_invocation.create import create_test_invocation
from app.routes.v5.tools.entries.test_invocation_bridge.create import (
    create_test_invocation_bridge,
)
from app.routes.v5.tools.entries.test_invocation_bridge.refresh import (
    refresh_test_invocation_bridge,
)
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio

MV = "test_invocation_bridge_mv"


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    test = await create_test(
        conn,
        call_id=call.id,
        profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    test_invocation = await create_test_invocation(
        conn, test_id=test.id, call_id=call2.id
    )
    benchmark = await create_benchmark(conn, session_id=session.id)
    invocation = await create_invocation(conn, benchmark_id=benchmark.id)
    return await create_test_invocation_bridge(
        conn,
        test_invocation_id=test_invocation.id,
        invocation_id=invocation.id,
        session_id=session.id,
    )


async def test_appears_after_refresh(conn):
    result = await _setup(conn)
    await refresh_test_invocation_bridge(conn)

    row = await conn.fetchrow(
        f"SELECT * FROM {MV} WHERE test_invocation_id = $1 AND invocation_id = $2",
        result.test_invocation_id,
        result.invocation_id,
    )
    assert row is not None


async def test_not_visible_before_refresh(conn):
    result = await _setup(conn)

    row = await conn.fetchrow(
        f"SELECT * FROM {MV} WHERE test_invocation_id = $1 AND invocation_id = $2",
        result.test_invocation_id,
        result.invocation_id,
    )
    assert row is None
