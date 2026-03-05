"""Tests for search_debug_info."""

from datetime import datetime, timedelta, UTC

import pytest

from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.debug_info.create import create_debug_info
from app.routes.v5.tools.entries.debug_info.refresh import refresh_debug_info
from app.routes.v5.tools.entries.debug_info.search import search_debug_info
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _call(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    return run, call


async def test_finds_created_debug_info(conn):
    run, call = await _call(conn)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await search_debug_info(conn, call_id=call.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_call_id(conn):
    run, call = await _call(conn)
    await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await search_debug_info(conn, call_id=nonexistent_id())

    assert items == []


async def test_filters_by_run_id(conn):
    run, call = await _call(conn)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await search_debug_info(conn, run_id=run.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_mcp(conn):
    run, call = await _call(conn)
    r_mcp = await create_debug_info(
        conn, call_id=call.id, content="mcp debug", run_id=run.id, mcp=True
    )
    r_normal = await create_debug_info(
        conn, call_id=call.id, content="normal debug", run_id=run.id, mcp=False
    )
    await refresh_debug_info(conn)

    items = await search_debug_info(conn, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_filters_by_date_from(conn):
    run, call = await _call(conn)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_debug_info(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    run, call = await _call(conn)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_debug_info(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_pagination_limit(conn):
    run, call = await _call(conn)
    await create_debug_info(
        conn, call_id=call.id, content="debug output 1", run_id=run.id
    )
    await create_debug_info(
        conn, call_id=call.id, content="debug output 2", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await search_debug_info(conn, call_id=call.id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    run, call = await _call(conn)
    await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )
    await refresh_debug_info(conn)

    items = await search_debug_info(conn)

    assert len(items) >= 1


async def test_bypass_mv(conn):
    run, call = await _call(conn)
    result = await create_debug_info(
        conn, call_id=call.id, content="debug output", run_id=run.id
    )

    items = await search_debug_info(conn, call_id=call.id, bypass_mv=True)

    ids = [item.id for item in items]
    assert result.id in ids
