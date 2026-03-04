"""Tests for model_drafts search."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.model_drafts.create import create_model_draft
from app.routes.v5.tools.entries.model_drafts.search import search_model_drafts
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    return session, group


async def test_search_finds_created(conn):
    session, group = await _setup(conn)
    result = await create_model_draft(conn, group_id=group.id, session_id=session.id)

    items = await search_model_drafts(conn, group_id=group.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_search_filters_by_group(conn):
    session, group = await _setup(conn)
    await create_model_draft(conn, group_id=group.id, session_id=session.id)

    items = await search_model_drafts(conn, group_id=uuid4())

    assert items == []


async def test_search_filters_by_session(conn):
    session, group = await _setup(conn)
    result = await create_model_draft(conn, group_id=group.id, session_id=session.id)

    items = await search_model_drafts(conn, session_id=session.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_search_returns_connections(conn):
    session, group = await _setup(conn)

    name_id = await conn.fetchval("SELECT id FROM names_resource LIMIT 1")

    result = await create_model_draft(
        conn,
        group_id=group.id,
        session_id=session.id,
        name_ids=[name_id],
    )

    items = await search_model_drafts(conn, group_id=group.id)

    match = [i for i in items if i.id == result.id]
    assert len(match) == 1
    assert name_id in match[0].name_ids


async def test_search_pagination(conn):
    session, group = await _setup(conn)
    await create_model_draft(conn, group_id=group.id, session_id=session.id)
    await create_model_draft(conn, group_id=group.id, session_id=session.id)

    items = await search_model_drafts(conn, group_id=group.id, limit=1)

    assert len(items) == 1
