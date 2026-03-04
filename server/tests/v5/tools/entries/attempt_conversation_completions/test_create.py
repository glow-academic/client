"""Tests for create_attempt_conversation_completions."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_chat.create import create_attempt_chat
from app.routes.v5.tools.entries.attempt_conversation_completions.create import (
    create_attempt_conversation_completions,
)
from app.routes.v5.tools.entries.attempt_conversation_completions.get import (
    get_attempt_conversation_completions,
)
from app.routes.v5.tools.entries.attempt_conversation_completions.refresh import (
    refresh_attempt_conversation_completions,
)
from app.routes.v5.tools.entries.attempt_conversations.create import (
    create_attempt_conversations,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _attempt_conversation_completions(conn, **overrides):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    persona = await create_persona(conn)
    await create_attempt(
        conn,
        call_id=call.id,
        user_persona_id=persona.id,
        profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    attempt_chat = await create_attempt_chat(
        conn, call_id=call2.id, group_id=group.id, chat_id=uuid4()
    )
    conversation = await create_attempt_conversations(
        conn, chat_id=attempt_chat.id, call_id=call2.id, run_id=run.id
    )
    defaults = dict(
        conversation_id=conversation.id,
        call_id=call2.id,
        end_reason="completed",
    )
    defaults.update(overrides)
    return await create_attempt_conversation_completions(conn, **defaults)


async def test_returns_id(conn):
    result = await _attempt_conversation_completions(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _attempt_conversation_completions(conn)
    await refresh_attempt_conversation_completions(conn)

    items = await get_attempt_conversation_completions(conn, [result.id])

    assert len(items) == 1


async def test_passes_mcp_flag(conn):
    result = await _attempt_conversation_completions(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM attempt_conversation_completions_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
