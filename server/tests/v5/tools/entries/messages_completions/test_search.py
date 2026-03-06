"""Tests for search_messages_completions."""

import pytest
from tests.helpers import nonexistent_id

from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.messages_completions.refresh import (
    refresh_messages_completions_internal,
)
from app.routes.v5.tools.entries.messages_completions.search import (
    search_messages_completions,
)
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, session_id=session.id, group_id=group.id)
    message_id = await conn.fetchval(
        "INSERT INTO messages_entry (run_id, role) VALUES ($1, 'user') RETURNING id",
        run.id,
    )
    entry_id = await conn.fetchval(
        "INSERT INTO messages_completions_entry (message_id, session_id) VALUES ($1, $2) RETURNING id",
        message_id,
        session.id,
    )
    return entry_id, message_id


async def test_finds_created_entry(conn, profile_id):
    entry_id, message_id = await _setup(conn, profile_id)
    await refresh_messages_completions_internal(conn)

    items = await search_messages_completions(conn, message_id=message_id)

    ids = [item.id for item in items]
    assert entry_id in ids


async def test_filters_by_message_id(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_messages_completions_internal(conn)

    items = await search_messages_completions(conn, message_id=nonexistent_id())

    assert items == []


async def test_pagination_limit(conn, profile_id):
    entry_id, message_id = await _setup(conn, profile_id)
    await refresh_messages_completions_internal(conn)

    items = await search_messages_completions(conn, message_id=message_id, limit=1)

    assert len(items) <= 1


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_messages_completions_internal(conn)

    items = await search_messages_completions(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    entry_id, message_id = await _setup(conn, profile_id)

    items = await search_messages_completions(
        conn, message_id=message_id, bypass_mv=True
    )

    ids = [item.id for item in items]
    assert entry_id in ids
