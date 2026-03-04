"""Tests for generic drafts CRUD infra functions.

Uses agent_drafts_entry as the representative table since all 19 drafts
tables have identical schemas.
"""

from datetime import datetime, timedelta, UTC
from uuid import uuid4

import pytest

from app.infra.drafts.crud import create_draft, get_drafts, search_drafts
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

TABLE = "agent_drafts_entry"

pytestmark = pytest.mark.asyncio


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    return session, group


# ── create_draft ─────────────────────────────────────────────────────────


async def test_create_returns_id(conn):
    session, group = await _setup(conn)
    result = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    assert result.id is not None


async def test_create_visible_via_get(conn):
    session, group = await _setup(conn)
    result = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await get_drafts(conn, TABLE, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].group_id == group.id
    assert items[0].session_id == session.id
    assert items[0].version == 0
    assert items[0].active is True
    assert items[0].mcp is False
    assert items[0].generated is True


async def test_create_with_version(conn):
    session, group = await _setup(conn)
    result = await create_draft(
        conn, TABLE, group_id=group.id, session_id=session.id, version=3
    )

    items = await get_drafts(conn, TABLE, [result.id])

    assert items[0].version == 3


async def test_create_with_mcp(conn):
    session, group = await _setup(conn)
    result = await create_draft(
        conn, TABLE, group_id=group.id, session_id=session.id, mcp=True
    )

    items = await get_drafts(conn, TABLE, [result.id])

    assert items[0].mcp is True


async def test_create_rejects_invalid_table(conn):
    with pytest.raises(ValueError, match="Invalid drafts table"):
        await create_draft(
            conn, "not_a_real_table", group_id=uuid4(), session_id=uuid4()
        )


# ── get_drafts ───────────────────────────────────────────────────────────


async def test_get_returns_by_id(conn):
    session, group = await _setup(conn)
    result = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await get_drafts(conn, TABLE, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_get_returns_multiple(conn):
    session, group = await _setup(conn)
    r1 = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)
    r2 = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await get_drafts(conn, TABLE, [r1.id, r2.id])

    assert len(items) == 2
    ids = {item.id for item in items}
    assert r1.id in ids
    assert r2.id in ids


async def test_get_returns_empty_for_missing(conn):
    items = await get_drafts(conn, TABLE, [uuid4()])

    assert items == []


async def test_get_returns_empty_for_empty_ids(conn):
    items = await get_drafts(conn, TABLE, [])

    assert items == []


# ── search_drafts ────────────────────────────────────────────────────────


async def test_search_finds_created(conn):
    session, group = await _setup(conn)
    result = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await search_drafts(conn, TABLE, group_id=group.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_search_filters_by_group(conn):
    session, group = await _setup(conn)
    await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await search_drafts(conn, TABLE, group_id=uuid4())

    assert items == []


async def test_search_filters_by_session(conn):
    session, group = await _setup(conn)
    result = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await search_drafts(conn, TABLE, session_id=session.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_search_filters_by_date_from(conn):
    session, group = await _setup(conn)
    result = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_drafts(conn, TABLE, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_search_filters_by_date_to(conn):
    session, group = await _setup(conn)
    result = await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_drafts(conn, TABLE, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_search_filters_by_mcp(conn):
    session, group = await _setup(conn)
    r_mcp = await create_draft(
        conn, TABLE, group_id=group.id, session_id=session.id, mcp=True
    )
    r_normal = await create_draft(
        conn, TABLE, group_id=group.id, session_id=session.id, mcp=False
    )

    items = await search_drafts(conn, TABLE, mcp=True)

    ids = [item.id for item in items]
    assert r_mcp.id in ids
    assert r_normal.id not in ids


async def test_search_pagination_limit(conn):
    session, group = await _setup(conn)
    await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)
    await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await search_drafts(conn, TABLE, group_id=group.id, limit=1)

    assert len(items) == 1


async def test_search_returns_all_without_filter(conn):
    session, group = await _setup(conn)
    await create_draft(conn, TABLE, group_id=group.id, session_id=session.id)

    items = await search_drafts(conn, TABLE)

    assert len(items) >= 1


async def test_works_with_different_table(conn):
    """Verify the generic function works with a different drafts table."""
    session, group = await _setup(conn)
    result = await create_draft(
        conn, "chat_drafts_entry", group_id=group.id, session_id=session.id
    )

    items = await get_drafts(conn, "chat_drafts_entry", [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
