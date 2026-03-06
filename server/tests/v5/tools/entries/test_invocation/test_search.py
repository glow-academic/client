"""Tests for search_test_invocation_entries_internal."""

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test_invocation.create import create_test_invocation
from app.routes.v5.tools.entries.test_invocation.refresh import refresh_test_invocation
from app.routes.v5.tools.entries.test_invocation.search import (
    search_test_invocation_entries_internal,
)
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    test = await create_test(conn, call_id=call.id, profiles_id=profile_id)
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    result = await create_test_invocation(conn, test_ids=[test.id], call_id=call2.id)
    return result, test


async def test_finds_created_entry(conn, profile_id):
    result, test = await _setup(conn, profile_id)
    await refresh_test_invocation(conn)

    items = await search_test_invocation_entries_internal(conn, test_ids=[test.id])

    ids = [item.invocation_id for item in items]
    assert result.id in ids


async def test_filters_by_test_id(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_test_invocation(conn)

    items = await search_test_invocation_entries_internal(
        conn, test_ids=[nonexistent_id()]
    )

    assert items == []


async def test_pagination_limit(conn, profile_id):
    result, test = await _setup(conn, profile_id)
    await refresh_test_invocation(conn)

    items = await search_test_invocation_entries_internal(
        conn, test_ids=[test.id], limit=1
    )

    assert len(items) <= 1


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)
    await refresh_test_invocation(conn)

    items = await search_test_invocation_entries_internal(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    result, test = await _setup(conn, profile_id)

    items = await search_test_invocation_entries_internal(
        conn, test_ids=[test.id], bypass_mv=True
    )

    ids = [item.invocation_id for item in items]
    assert result.id in ids
