"""Tests for provider_drafts search wrapper."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.provider_drafts.create import create_provider_drafts
from app.routes.v5.tools.entries.provider_drafts.search import search_provider_drafts
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    return session, group


async def test_finds_created(conn):
    session, group = await _setup(conn)
    result = await create_provider_drafts(
        conn, group_id=group.id, session_id=session.id
    )

    items = await search_provider_drafts(conn, group_id=group.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_group(conn):
    session, group = await _setup(conn)
    await create_provider_drafts(conn, group_id=group.id, session_id=session.id)

    items = await search_provider_drafts(conn, group_id=uuid4())

    assert items == []
