"""Tests for create_emulation."""

import pytest

from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.emulations.create import create_emulation
from app.routes.v5.tools.entries.emulations.get import get_emulations
from app.routes.v5.tools.entries.emulations.refresh import refresh_emulations
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def _grant(conn, session_id):
    result = await create_grant(conn, session_id=session_id)
    return result.id


async def test_returns_id(conn):
    session = await _session(conn)
    grant_id = await _grant(conn, session.id)
    result = await create_emulation(conn, grant_id=grant_id, session_id=session.id)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    session = await _session(conn)
    grant_id = await _grant(conn, session.id)
    result = await create_emulation(conn, grant_id=grant_id, session_id=session.id)
    await refresh_emulations(conn)

    items = await get_emulations(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].grant_id == grant_id
    assert items[0].session_id == session.id
    assert items[0].active is True
    assert items[0].mcp is False


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    grant_id = await _grant(conn, session.id)
    result = await create_emulation(conn, grant_id=grant_id, session_id=session.id, mcp=True)
    await refresh_emulations(conn)

    items = await get_emulations(conn, [result.id])

    assert len(items) == 1
    assert items[0].mcp is True


async def test_links_profile(conn):
    session = await _session(conn)
    grant_id = await _grant(conn, session.id)
    result = await create_emulation(
        conn,
        grant_id=grant_id,
        session_id=session.id,
        profile_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    await refresh_emulations(conn)

    items = await get_emulations(conn, [result.id])

    assert len(items) == 1
    assert items[0].profile_id == SUPERADMIN_PROFILES_RESOURCE_ID
