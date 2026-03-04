"""Tests for refresh_emulations."""

import pytest

from app.routes.v5.tools.entries.emulations.create import create_emulation
from app.routes.v5.tools.entries.emulations.get import get_emulations
from app.routes.v5.tools.entries.emulations.refresh import refresh_emulations
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def _grant(conn):
    return await conn.fetchval(
        "INSERT INTO grants_entry (expires_at) VALUES (now() + interval '1 hour') RETURNING id"
    )


async def test_new_emulation_appears_after_refresh(conn):
    session = await _session(conn)
    grant_id = await _grant(conn)
    result = await create_emulation(conn, grant_id=grant_id, session_id=session.id)
    await refresh_emulations(conn)

    items = await get_emulations(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_new_emulation_not_visible_before_refresh(conn):
    session = await _session(conn)
    grant_id = await _grant(conn)
    result = await create_emulation(conn, grant_id=grant_id, session_id=session.id)

    items = await get_emulations(conn, [result.id])

    assert items == []
