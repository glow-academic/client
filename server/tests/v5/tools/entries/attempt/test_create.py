"""Tests for create_attempt."""

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt.get import get_attempts
from app.routes.v5.tools.entries.attempt.refresh import refresh_attempt
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _attempt(conn, **overrides):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    persona = await create_persona(conn)
    defaults = dict(
        call_id=call.id,
        user_persona_id=persona.id,
        profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    defaults.update(overrides)
    result = await create_attempt(conn, **defaults)
    return session, result


async def test_returns_id(conn):
    _, result = await _attempt(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    _, result = await _attempt(conn)
    await refresh_attempt(conn)

    items = await get_attempts(conn, [result.id])

    assert len(items) == 1
    assert items[0].attempt_id == result.id


async def test_num_chats_and_practice(conn):
    _, result = await _attempt(conn, num_chats=3, practice=True)
    await refresh_attempt(conn)

    items = await get_attempts(conn, [result.id])

    assert len(items) == 1
    assert items[0].num_chats == 3
    assert items[0].practice is True


async def test_passes_mcp_flag(conn):
    _, result = await _attempt(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM attempt_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
