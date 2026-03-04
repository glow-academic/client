"""Tests for create_problem."""

import pytest

from app.routes.v5.tools.entries.problems.create import create_problem
from app.routes.v5.tools.entries.problems.get import get_problems
from app.routes.v5.tools.entries.problems.refresh import refresh_problems
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_returns_id(conn):
    session = await _session(conn)
    result = await create_problem(conn, session_id=session.id, type="bug")

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    session = await _session(conn)
    result = await create_problem(conn, session_id=session.id, type="bug")
    await refresh_problems(conn)

    items = await get_problems(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].session_id == session.id
    assert items[0].type == "bug"
    assert items[0].message == "No message provided"
    assert items[0].active is True
    assert items[0].mcp is False


async def test_passes_custom_message(conn):
    session = await _session(conn)
    result = await create_problem(
        conn, session_id=session.id, type="feature", message="Custom message"
    )
    await refresh_problems(conn)

    items = await get_problems(conn, [result.id])

    assert len(items) == 1
    assert items[0].message == "Custom message"
    assert items[0].type == "feature"


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    result = await create_problem(conn, session_id=session.id, type="bug", mcp=True)
    await refresh_problems(conn)

    items = await get_problems(conn, [result.id])

    assert len(items) == 1
    assert items[0].mcp is True


async def test_links_profile(conn):
    session = await _session(conn)
    result = await create_problem(
        conn,
        session_id=session.id,
        type="question",
        profile_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    await refresh_problems(conn)

    items = await get_problems(conn, [result.id])

    assert len(items) == 1
    assert items[0].profile_id == SUPERADMIN_PROFILES_RESOURCE_ID
