"""Tests for search_personas."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.personas.create import create_personas
from app.routes.v5.tools.entries.personas.search import search_personas
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_search_finds_created(conn):
    session = await _session(conn)
    result = await create_personas(conn, session_id=session.id)

    items = await search_personas(conn, session_id=session.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_search_filters_by_session(conn):
    session = await _session(conn)
    await create_personas(conn, session_id=session.id)

    items = await search_personas(conn, session_id=uuid4())

    assert items == []


async def test_search_returns_connections(conn):
    session = await _session(conn)
    persona_id = await conn.fetchval("SELECT id FROM personas_resource LIMIT 1")
    assert persona_id is not None, "Need at least one personas_resource row as seed data"

    result = await create_personas(conn, session_id=session.id, persona_ids=[persona_id])

    items = await search_personas(conn, session_id=session.id)

    matched = [item for item in items if item.id == result.id]
    assert len(matched) == 1
    assert persona_id in matched[0].persona_ids


async def test_search_pagination(conn):
    session = await _session(conn)
    await create_personas(conn, session_id=session.id)
    await create_personas(conn, session_id=session.id)

    items = await search_personas(conn, session_id=session.id, limit=1)

    assert len(items) == 1
