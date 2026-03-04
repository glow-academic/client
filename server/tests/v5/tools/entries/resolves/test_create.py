"""Tests for create_resolve."""

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


async def test_returns_id(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=True)
    await refresh_resolves(conn)

    items = await get_resolves(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].problem_id == problem_id
    assert items[0].active is True
    assert items[0].mcp is False


async def test_passes_resolved_flag(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=True)
    await refresh_resolves(conn)

    items = await get_resolves(conn, [result.id])

    assert len(items) == 1
    assert items[0].resolved is True


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    result = await create_resolve(conn, problem_id=problem_id, resolved=False, mcp=True)
    await refresh_resolves(conn)

    items = await get_resolves(conn, [result.id])

    assert len(items) == 1
    assert items[0].mcp is True


async def test_passes_call_id(conn):
    session = await _session(conn)
    problem_id = await _problem_id(conn, session.id)
    from app.routes.v5.tools.entries.groups.create import create_group
    from app.routes.v5.tools.entries.runs.create import create_run
    from app.routes.v5.tools.entries.calls.create import create_call

    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)

    result = await create_resolve(conn, problem_id=problem_id, resolved=False, call_id=call.id)
    await refresh_resolves(conn)

    items = await get_resolves(conn, [result.id])

    assert len(items) == 1
    assert items[0].call_id == call.id
