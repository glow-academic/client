"""Tests for create_group."""

import pytest

from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.groups.get import get_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_creates_group_entry(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id)

    assert result.id is not None


async def test_group_exists_in_table(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id)

    group = await get_group(conn, result.id)

    assert group is not None
    assert group.active is True
    assert group.session_id == session.id


async def test_passes_name(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id, name="test-group")

    group = await get_group(conn, result.id)

    assert group is not None
    assert group.name == "test-group"


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    result = await create_group(conn, session_id=session.id, mcp=True)

    group = await get_group(conn, result.id)

    assert group is not None
    assert group.mcp is True
