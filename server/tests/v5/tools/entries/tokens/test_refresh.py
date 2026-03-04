"""Tests for refresh_tokens."""

import pytest

from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.tokens.create import create_token
from app.routes.v5.tools.entries.tokens.get import get_tokens
from app.routes.v5.tools.entries.tokens.refresh import refresh_tokens
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _run(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, session_id=session.id, group_id=group.id)
    return run


async def test_appears_after_refresh(conn):
    run = await _run(conn)
    result = await create_token(conn, run_id=run.id)
    await refresh_tokens(conn)

    items = await get_tokens(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id


async def test_not_visible_before_refresh(conn):
    run = await _run(conn)
    result = await create_token(conn, run_id=run.id)

    items = await get_tokens(conn, [result.id])

    assert items == []
