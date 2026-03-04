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


async def _group(conn, session_id):
    return await create_group(conn, session_id=session_id)


async def test_creates_run_entry(conn):
    session = await _session(conn)
    group = await _group(conn, session.id)
    result = await create_run(conn, group_id=group.id, session_id=session.id)

    assert result.id is not None


async def test_run_exists_in_table(conn):
    session = await _session(conn)
    group = await _group(conn, session.id)
    result = await create_run(conn, group_id=group.id, session_id=session.id)

    run = await get_run(conn, result.id)

    assert run is not None
    assert run.group_id == group.id
    assert run.session_id == session.id


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    group = await _group(conn, session.id)
    result = await create_run(conn, group_id=group.id, session_id=session.id, mcp=True)

    run = await get_run(conn, result.id)

    assert run is not None
    assert run.mcp is True
