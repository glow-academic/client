"""Tests for search_attempt_chat_entries_internal."""

import pytest
from tests.helpers import nonexistent_id

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_chat.create import create_attempt_chat
from app.routes.v5.tools.entries.attempt_chat.refresh import refresh_attempt_chat
from app.routes.v5.tools.entries.attempt_chat.search import (
    search_attempt_chat_entries_internal,
)
from app.routes.v5.tools.entries.attempt_chat_bridge.create import (
    create_attempt_chat_bridge,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.chat.create import create_chat
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    """Create full chain: session -> group -> run -> call -> persona -> attempt -> chat -> attempt_chat -> bridge."""
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
    chat = await create_chat(conn, session_id=session.id)
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    result = await create_attempt_chat(
        conn, call_id=call2.id, group_id=group.id, chat_id=chat.id
    )
    await create_attempt_chat_bridge(
        conn,
        attempt_id=attempt.id,
        attempt_chat_id=result.id,
        session_id=session.id,
    )
    return result, attempt, group


async def test_finds_created_entry(conn, profile_id):
    result, attempt, _ = await _setup(conn, profile_id)
    await refresh_attempt_chat(conn)

    items = await search_attempt_chat_entries_internal(
        conn, attempt_ids=[attempt.id]
    )

    ids = [item.chat_id for item in items]
    assert result.id in ids


async def test_filters_by_attempt_id(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_attempt_chat(conn)

    items = await search_attempt_chat_entries_internal(
        conn, attempt_ids=[nonexistent_id()]
    )

    assert items == []


async def test_filters_by_group_id(conn, profile_id):
    result, _, group = await _setup(conn, profile_id)
    await refresh_attempt_chat(conn)

    items = await search_attempt_chat_entries_internal(conn, group_ids=[group.id])

    ids = [item.chat_id for item in items]
    assert result.id in ids


async def test_pagination_limit(conn, profile_id):
    result, attempt, _ = await _setup(conn, profile_id)
    await refresh_attempt_chat(conn)

    items = await search_attempt_chat_entries_internal(
        conn, attempt_ids=[attempt.id], limit=1
    )

    assert len(items) <= 1


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_attempt_chat(conn)

    items = await search_attempt_chat_entries_internal(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    result, attempt, _ = await _setup(conn, profile_id)

    items = await search_attempt_chat_entries_internal(
        conn, attempt_ids=[attempt.id], bypass_mv=True
    )

    ids = [item.chat_id for item in items]
    assert result.id in ids
