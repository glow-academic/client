"""Tests for refresh_grant_consumptions."""

import pytest

from app.routes.v5.tools.entries.grant_consumptions.create import (
    create_grant_consumption,
)
from app.routes.v5.tools.entries.grant_consumptions.get import get_grant_consumptions
from app.routes.v5.tools.entries.grant_consumptions.refresh import (
    refresh_grant_consumptions,
)
from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_new_grant_consumption_appears_after_refresh(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    grant = await create_grant(conn, session_id=session.id)
    result = await create_grant_consumption(conn, grant_id=grant.id)

    await refresh_grant_consumptions(conn)

    items = await get_grant_consumptions(conn, [result.id])
    assert len(items) == 1
    assert items[0].id == result.id


async def test_new_grant_consumption_not_visible_before_refresh(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    grant = await create_grant(conn, session_id=session.id)
    result = await create_grant_consumption(conn, grant_id=grant.id)

    items = await get_grant_consumptions(conn, [result.id])
    assert items == []
