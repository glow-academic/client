"""Tests for create_run."""

import pytest

from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.runs.get import get_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.groups.create import create_group
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_creates_run_entry(conn):
    result = await create_run(conn)

    assert result.id is not None


async def test_run_exists_in_table(conn):
    result = await create_run(conn)

    run = await get_run(conn, result.id)

    assert run is not None


async def test_passes_session_id(conn):
    session = await _session(conn)
    result = await create_run(conn, session_id=session.id)

    run = await get_run(conn, result.id)

    assert run is not None
    assert run.session_id == session.id


async def test_passes_group_id(conn):
    group = await create_group(conn)
    result = await create_run(conn, group_id=group.id)

    run = await get_run(conn, result.id)

    assert run is not None
    assert run.group_id == group.id


async def test_passes_mcp_flag(conn):
    result = await create_run(conn, mcp=True)

    run = await get_run(conn, result.id)

    assert run is not None
    assert run.mcp is True
