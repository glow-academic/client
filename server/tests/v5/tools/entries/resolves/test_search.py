"""Tests for search_resolves."""

from datetime import datetime, timedelta, UTC
from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.resolves.create import create_resolve
from app.routes.v5.tools.entries.resolves.refresh import refresh_resolves
from app.routes.v5.tools.entries.resolves.search import search_resolves
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


async def test_finds_created_resolve(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    items = await search_resolves(conn, problem_id=problem_id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_problem_id(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    items = await search_resolves(conn, problem_id=uuid4())

    assert items == []


async def test_filters_by_resolved(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    r_resolved = await create_resolve(conn, problem_id=problem_id, resolved=True)
    r_unresolved = await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    items = await search_resolves(conn, resolved=True)

    ids = [item.id for item in items]
    assert r_resolved.id in ids
    assert r_unresolved.id not in ids


async def test_filters_by_mcp(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    r_mcp = await create_resolve(conn, problem_id=problem_id, resolved=False, mcp=True)
    r_normal = await create_resolve(conn, problem_id=problem_id, resolved=False, mcp=False)
    await refresh_resolves(conn)

    items = await search_resolves(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_filters_by_date_from(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_resolves(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_resolves(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_pagination_limit(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    await create_resolve(conn, problem_id=problem_id, resolved=False)
    await create_resolve(conn, problem_id=problem_id, resolved=True)
    await refresh_resolves(conn)

    items = await search_resolves(conn, problem_id=problem_id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    await create_resolve(conn, problem_id=problem_id, resolved=False)
    await refresh_resolves(conn)

    items = await search_resolves(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)

    items = await search_resolves(conn, problem_id=problem_id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
