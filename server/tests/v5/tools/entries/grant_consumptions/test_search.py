"""Tests for search_grant_consumptions."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.grant_consumptions.create import (
    create_grant_consumption,
)
from app.routes.v5.tools.entries.grant_consumptions.search import (
    search_grant_consumptions,
)
from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _grant(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    grant = await create_grant(conn, session_id=session.id)
    return grant


async def test_finds_created(conn):
    grant = await _grant(conn)
    result = await create_grant_consumption(conn, grant_id=grant.id)

    items = await search_grant_consumptions(conn, grant_id=grant.id)

    ids = [item.id for item in items]
    assert result.id in ids


async def test_filters_by_grant_id(conn):
    grant = await _grant(conn)
    await create_grant_consumption(conn, grant_id=grant.id)

    items = await search_grant_consumptions(conn, grant_id=uuid4())

    assert items == []


async def test_filters_by_date_from(conn):
    grant = await _grant(conn)
    result = await create_grant_consumption(conn, grant_id=grant.id)

    future = datetime.now(UTC) + timedelta(days=1)
    items = await search_grant_consumptions(conn, date_from=future)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_filters_by_date_to(conn):
    grant = await _grant(conn)
    result = await create_grant_consumption(conn, grant_id=grant.id)

    past = datetime.now(UTC) - timedelta(days=1)
    items = await search_grant_consumptions(conn, date_to=past)

    ids = [item.id for item in items]
    assert result.id not in ids


async def test_pagination_limit(conn):
    grant = await _grant(conn)
    await create_grant_consumption(conn, grant_id=grant.id)
    await create_grant_consumption(conn, grant_id=grant.id)

    items = await search_grant_consumptions(conn, grant_id=grant.id, limit=1)

    assert len(items) == 1


async def test_returns_all_without_filter(conn):
    grant = await _grant(conn)
    await create_grant_consumption(conn, grant_id=grant.id)

    items = await search_grant_consumptions(conn)

    assert len(items) >= 1
