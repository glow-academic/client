"""Tests for create_chat."""

import pytest

from app.routes.v5.tools.entries.chat.create import create_chat
from app.routes.v5.tools.entries.chat.get import get_chats
from app.routes.v5.tools.entries.chat.refresh import refresh_chat
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import (
    SUPERADMIN_PROFILES_RESOURCE_ID,
    UNIVERSITY_DEPT_ID,
)

pytestmark = pytest.mark.asyncio


async def _chat(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    return session, await create_chat(
        conn,
        session_id=session.id,
        department_ids=[UNIVERSITY_DEPT_ID],
    )


async def test_returns_id(conn):
    _, result = await _chat(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    _, result = await _chat(conn)
    await refresh_chat(conn)

    items = await get_chats(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_departments_populated(conn):
    _, result = await _chat(conn)
    await refresh_chat(conn)

    items = await get_chats(conn, [result.id])

    assert len(items) == 1
    assert UNIVERSITY_DEPT_ID in items[0].department_ids


async def test_passes_mcp_flag(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    result = await create_chat(
        conn,
        session_id=session.id,
        mcp=True,
    )

    row = await conn.fetchrow(
        "SELECT mcp FROM chat_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
