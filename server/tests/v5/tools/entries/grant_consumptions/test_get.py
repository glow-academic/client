"""Tests for get_grant_consumptions."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.grant_consumptions.create import (
    create_grant_consumption,
)
from app.routes.v5.tools.entries.grant_consumptions.get import get_grant_consumptions
from app.routes.v5.tools.entries.grants.create import create_grants_entry_internal
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _grant(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    grant = await create_grants_entry_internal(
        conn, session_id=session.id, expires_at="2099-12-31T23:59:59Z"
    )
    return grant


async def test_returns_by_id(conn):
    grant = await _grant(conn)
    result = await create_grant_consumption(conn, grant_id=grant.id)

    items = await get_grant_consumptions(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].grant_id == grant.id
    assert items[0].active is True
    assert items[0].created_at is not None


async def test_returns_multiple(conn):
    grant = await _grant(conn)
    r1 = await create_grant_consumption(conn, grant_id=grant.id)
    r2 = await create_grant_consumption(conn, grant_id=grant.id)

    items = await get_grant_consumptions(conn, [r1.id, r2.id])

    assert len(items) == 2
    ids = {item.id for item in items}
    assert r1.id in ids
    assert r2.id in ids


async def test_returns_empty_for_missing(conn):
    items = await get_grant_consumptions(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_grant_consumptions(conn, [])

    assert items == []
