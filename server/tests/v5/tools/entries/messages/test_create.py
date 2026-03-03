"""Tests for create_message."""

import pytest

from app.routes.v5.tools.entries.messages.create import create_message
from app.routes.v5.tools.entries.runs.create import create_run

pytestmark = pytest.mark.asyncio


async def test_creates_message_entry(conn):
    run = await create_run(conn)
    result = await create_message(conn, run_id=run.id, role="user")

    assert result.id is not None
    assert result.created_at is not None


async def test_message_exists_in_table(conn):
    run = await create_run(conn)
    result = await create_message(conn, run_id=run.id, role="assistant")

    row = await conn.fetchrow("""
        SELECT id, run_id, role, active FROM messages_entry WHERE id = $1
    """, result.id)

    assert row is not None
    assert row["run_id"] == run.id
    assert str(row["role"]) == "assistant"
    assert row["active"] is True


async def test_passes_mcp_flag(conn):
    run = await create_run(conn)
    result = await create_message(conn, run_id=run.id, role="user", mcp=True)

    row = await conn.fetchrow("""
        SELECT mcp FROM messages_entry WHERE id = $1
    """, result.id)

    assert row["mcp"] is True
