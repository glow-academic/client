"""Tests for refresh_resolves."""

import pytest

from app.routes.v5.tools.entries.resolves.create import create_resolve
from app.routes.v5.tools.entries.resolves.get import get_resolves
from app.routes.v5.tools.entries.resolves.refresh import refresh_resolves
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def _problem_id(conn, session_id):
    return await conn.fetchval(
        "INSERT INTO problems_entry (session_id, type, generated) VALUES ($1, 'bug', true) RETURNING id",
        session_id,
    )


async def test_appears_after_refresh(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    items = await get_resolves(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_not_visible_before_refresh(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)

    items = await get_resolves(conn, [result.id])

    assert items == []
