"""Tests for get_resolves."""

from uuid import uuid4

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


async def test_returns_by_id(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    items = await get_resolves(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].problem_id == problem_id
    assert items[0].active is True
    assert items[0].created_at is not None


async def test_returns_multiple(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    r1 = await create_resolve(conn, problem_id=problem_id, resolved=False)
    r2 = await create_resolve(conn, problem_id=problem_id, resolved=True)
    await refresh_resolves(conn)

    items = await get_resolves(conn, [r1.id, r2.id])

    assert len(items) == 2
    ids = {item.id for item in items}
    assert r1.id in ids
    assert r2.id in ids


async def test_returns_empty_for_missing(conn):
    items = await get_resolves(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_resolves(conn, [])

    assert items == []


async def test_bypass_mv(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)

    items = await get_resolves(conn, [result.id], bypass_mv=True)

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].problem_id == problem_id
