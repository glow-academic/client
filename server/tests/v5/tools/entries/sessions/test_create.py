"""Tests for create_session."""

import pytest
from uuid import uuid4

from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_creates_session_entry(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    assert result.id is not None


async def test_creates_profile_connection(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    row = await conn.fetchrow("""
        SELECT profiles_id, session_id
        FROM profiles_sessions_connection
        WHERE session_id = $1
    """, result.id)

    assert row is not None
    assert row["profiles_id"] == SUPERADMIN_PROFILES_RESOURCE_ID


async def test_session_exists_in_table(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    row = await conn.fetchrow("""
        SELECT id, active FROM sessions_entry WHERE id = $1
    """, result.id)

    assert row is not None
    assert row["active"] is True


async def test_passes_session_id(conn):
    parent_session_id = uuid4()
    result = await create_session(
        conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID, session_id=parent_session_id,
    )

    row = await conn.fetchrow("""
        SELECT session_id FROM sessions_entry WHERE id = $1
    """, result.id)

    assert row["session_id"] == parent_session_id


async def test_passes_mcp_flag(conn):
    result = await create_session(
        conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID, mcp=True,
    )

    row = await conn.fetchrow("""
        SELECT mcp FROM sessions_entry WHERE id = $1
    """, result.id)

    assert row["mcp"] is True
