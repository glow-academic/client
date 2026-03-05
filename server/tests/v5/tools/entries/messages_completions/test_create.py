"""Tests for messages_completions entry."""

import pytest

from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session

pytestmark = pytest.mark.asyncio


async def _message(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, session_id=session.id, group_id=group.id)
    message_id = await conn.fetchval(
        "INSERT INTO messages_entry (run_id, role) VALUES ($1, 'user') RETURNING id",
        run.id,
    )
    return session, message_id


async def test_create_returns_id(conn, profile_id):
    session, message_id = await _message(conn, profile_id)

    entry_id = await conn.fetchval(
        "INSERT INTO messages_completions_entry (message_id, session_id) VALUES ($1, $2) RETURNING id",
        message_id,
        session.id,
    )

    assert entry_id is not None


async def test_roundtrip_via_db(conn, profile_id):
    session, message_id = await _message(conn, profile_id)

    entry_id = await conn.fetchval(
        "INSERT INTO messages_completions_entry (message_id, session_id) VALUES ($1, $2) RETURNING id",
        message_id,
        session.id,
    )

    row = await conn.fetchrow(
        "SELECT * FROM messages_completions_entry WHERE id = $1", entry_id
    )

    assert row is not None
    assert row["id"] == entry_id
    assert row["message_id"] == message_id
    assert row["session_id"] == session.id
    assert row["active"] is True
    assert row["mcp"] is False
    assert row["generated"] is False
