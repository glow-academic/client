"""Tests for create_grant."""

import pytest

from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_create_returns_id(conn):
    session = await _session(conn)
    result = await create_grant(conn, session_id=session.id)

    assert result.id is not None


async def test_roundtrip_via_db(conn):
    session = await _session(conn)
    result = await create_grant(conn, session_id=session.id)

    row = await conn.fetchrow(
        "SELECT * FROM grants_entry WHERE id = $1", result.id
    )

    assert row is not None
    assert row["id"] == result.id
    assert row["session_id"] == session.id
    assert row["active"] is True
    assert row["mcp"] is False
    assert row["generated"] is True


async def test_default_expiry(conn):
    session = await _session(conn)
    result = await create_grant(conn, session_id=session.id)

    row = await conn.fetchrow(
        "SELECT * FROM grants_entry WHERE id = $1", result.id
    )

    assert row is not None
    assert row["expires_at"] is not None
