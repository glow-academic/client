"""Tests for create_test_archive."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test_archive.create import create_test_archive
from app.routes.v5.tools.entries.test_archive.get import get_test_archives
from app.routes.v5.tools.entries.test_archive.refresh import refresh_test_archive
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _test_archive(conn, **overrides):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    test = await create_test(
        conn, call_id=call.id, profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID
    )
    defaults = dict(
        test_id=test.id,
        call_id=call.id,
        archived=True,
    )
    defaults.update(overrides)
    return await create_test_archive(conn, **defaults)


async def test_returns_id(conn):
    result = await _test_archive(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _test_archive(conn)
    await refresh_test_archive(conn)

    items = await get_test_archives(conn, [result.id])

    assert len(items) == 1


async def test_passes_mcp_flag(conn):
    result = await _test_archive(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM test_archive_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
