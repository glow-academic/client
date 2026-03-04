"""Tests for refresh_grant_consumptions."""

import pytest

from app.routes.v5.tools.entries.grant_consumptions.create import (
    create_grant_consumption,
)
from app.routes.v5.tools.entries.grant_consumptions.refresh import (
    refresh_grant_consumptions,
)
from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio

MV = "grant_consumptions_mv"


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    grant = await create_grant(conn, session_id=session.id)
    return await create_grant_consumption(conn, grant_id=grant.id)


async def test_appears_after_refresh(conn):
    result = await _setup(conn)
    await refresh_grant_consumptions(conn)

    row = await conn.fetchrow(
        f"SELECT * FROM {MV} WHERE id = $1",
        result.id,
    )
    assert row is not None


async def test_not_visible_before_refresh(conn):
    result = await _setup(conn)

    row = await conn.fetchrow(
        f"SELECT * FROM {MV} WHERE id = $1",
        result.id,
    )
    assert row is None
