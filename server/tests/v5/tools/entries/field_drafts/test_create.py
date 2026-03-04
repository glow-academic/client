"""Tests for field_drafts create wrapper."""

import pytest

from app.routes.v5.tools.entries.field_drafts.create import create_field_drafts
from app.routes.v5.tools.entries.field_drafts.get import get_field_drafts
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    return session, group


async def test_create_returns_id(conn):
    session, group = await _setup(conn)
    result = await create_field_drafts(conn, group_id=group.id, session_id=session.id)

    assert result.id is not None


async def test_roundtrip(conn):
    session, group = await _setup(conn)
    result = await create_field_drafts(conn, group_id=group.id, session_id=session.id)

    items = await get_field_drafts(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].group_id == group.id
    assert items[0].session_id == session.id
