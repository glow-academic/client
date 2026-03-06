"""Tests for search_attempts."""

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt.refresh import refresh_attempt
from app.routes.v5.tools.entries.attempt.search import search_attempts
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    persona = await create_persona(conn)
    attempt = await create_attempt(
        conn,
        call_id=call.id,
        user_persona_id=persona.id,
        profiles_id=profile_id,
    )
    return attempt


async def test_finds_created_entry(conn, profile_id):
    attempt = await _setup(conn, profile_id)
    await refresh_attempt(conn)

    items = await search_attempts(conn)

    ids = [item.attempt_id for item in items]
    assert attempt.id in ids


async def test_filters_by_profile_id(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_attempt(conn)

    items = await search_attempts(conn, profile_id=nonexistent_id())

    assert items == []


async def test_pagination_limit(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_attempt(conn)

    items = await search_attempts(conn, limit=1)

    assert len(items) <= 1


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_attempt(conn)

    items = await search_attempts(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    attempt = await _setup(conn, profile_id)

    items = await search_attempts(conn, bypass_mv=True)

    ids = [item.attempt_id for item in items]
    assert attempt.id in ids
