"""Tests for create_session."""

import pytest

from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_returns_id(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    assert result.id is not None


async def test_inserts_into_base_table(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    row = await conn.fetchrow(
        "SELECT id, active, mcp, generated FROM sessions_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["active"] is True
    assert row["generated"] is True


async def test_creates_profile_connection(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    row = await conn.fetchrow(
        "SELECT profiles_id FROM profiles_sessions_connection WHERE session_id = $1",
        result.id,
    )
    assert row is not None
    assert row["profiles_id"] == SUPERADMIN_PROFILES_RESOURCE_ID


async def test_passes_mcp_flag(conn):
    result = await create_session(
        conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID, mcp=True,
    )

    row = await conn.fetchrow(
        "SELECT mcp FROM sessions_entry WHERE id = $1", result.id,
    )
    assert row["mcp"] is True
