"""Tests for create_file."""

import pytest

from app.routes.v5.tools.entries.files.create import create_file
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_creates_file_entry(conn):
    session = await _session(conn)
    result = await create_file(conn, session_id=session.id)

    assert result.id is not None


async def test_file_exists_in_table(conn):
    session = await _session(conn)
    result = await create_file(conn, session_id=session.id)

    row = await conn.fetchrow("""
        SELECT id, session_id, active FROM files_entry WHERE id = $1
    """, result.id)

    assert row is not None
    assert row["session_id"] == session.id
    assert row["active"] is True


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    result = await create_file(conn, session_id=session.id, mcp=True)

    row = await conn.fetchrow("""
        SELECT mcp FROM files_entry WHERE id = $1
    """, result.id)

    assert row["mcp"] is True
