"""Tests for refresh_eval_drafts."""

import pytest

from app.routes.v5.tools.entries.eval_drafts.create import create_eval_draft
from app.routes.v5.tools.entries.eval_drafts.refresh import refresh_eval_drafts
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    return session, group


async def test_new_draft_appears_in_mv_after_refresh(conn):
    session, group = await _setup(conn)
    result = await create_eval_draft(conn, group_id=group.id, session_id=session.id)

    row = await conn.fetchrow("SELECT id FROM eval_drafts_mv WHERE id = $1", result.id)
    assert row is None

    await refresh_eval_drafts(conn)

    row = await conn.fetchrow("SELECT id FROM eval_drafts_mv WHERE id = $1", result.id)
    assert row is not None
    assert row["id"] == result.id
