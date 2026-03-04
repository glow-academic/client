"""Tests for create_attempt_message_tree."""

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_chat.create import create_attempt_chat
from app.routes.v5.tools.entries.attempt_message.create import create_attempt_message
from app.routes.v5.tools.entries.attempt_message_tree.create import (
    create_attempt_message_tree,
)
from app.routes.v5.tools.entries.attempt_message_tree.get import (
    get_attempt_message_trees,
)
from app.routes.v5.tools.entries.attempt_message_tree.refresh import (
    refresh_attempt_message_tree,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.chat.create import create_chat
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.messages.create import create_message
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _attempt_message_tree(conn, **overrides):
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
    real_chat = await create_chat(conn, session_id=session.id)
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    chat = await create_attempt_chat(
        conn, call_id=call2.id, group_id=group.id, chat_id=real_chat.id
    )
    msg1 = await create_message(conn, run_id=run.id, role="user")
    msg2 = await create_message(conn, run_id=run.id, role="assistant")
    await create_attempt_message(
        conn, chat_id=chat.id, call_id=call2.id, message_id=msg1.id
    )
    await create_attempt_message(
        conn, chat_id=chat.id, call_id=call2.id, message_id=msg2.id
    )
    defaults = dict(
        parent_id=msg1.id,
        child_id=msg2.id,
        session_id=session.id,
    )
    defaults.update(overrides)
    return await create_attempt_message_tree(conn, **defaults)


async def test_returns_ids(conn):
    result = await _attempt_message_tree(conn)

    assert result is not None
    assert result.parent_id is not None
    assert result.child_id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _attempt_message_tree(conn)
    await refresh_attempt_message_tree(conn)

    # get_attempt_message_trees queries by message_id
    items = await get_attempt_message_trees(conn, [result.parent_id])

    assert len(items) >= 1


async def test_passes_mcp_flag(conn):
    result = await _attempt_message_tree(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM attempt_message_tree_entry WHERE parent_id = $1 AND child_id = $2",
        result.parent_id,
        result.child_id,
    )
    assert row is not None
    assert row["mcp"] is True
