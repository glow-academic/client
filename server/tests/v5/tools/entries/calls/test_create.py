"""Tests for create_call."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.calls.get import get_call
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _run(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    return await create_run(conn, session_id=session.id)


async def test_creates_call_entry(conn):
    result = await create_call(conn)

    assert result.id is not None


async def test_call_exists_in_table(conn):
    result = await create_call(conn)

    call = await get_call(conn, result.id)

    assert call is not None
    assert call.active is True


async def test_passes_run_id(conn):
    run = await _run(conn)
    result = await create_call(conn, run_id=run.id)

    call = await get_call(conn, result.id)

    assert call is not None
    assert call.run_id == run.id


async def test_passes_external_call_id(conn):
    result = await create_call(conn, external_call_id="test_call_123")

    call = await get_call(conn, result.id)

    assert call is not None
    assert call.external_call_id == "test_call_123"


async def test_passes_mcp_flag(conn):
    result = await create_call(conn, mcp=True)

    call = await get_call(conn, result.id)

    assert call is not None
    assert call.mcp is True
