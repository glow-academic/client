"""Tests for create_session."""

import pytest
from uuid import uuid4

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.sessions.get import get_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_creates_session_entry(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    assert result.id is not None


async def test_creates_profile_connection(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    session = await get_session(conn, result.id, profile=True)

    assert session is not None
    assert session.profiles_id == SUPERADMIN_PROFILES_RESOURCE_ID


async def test_session_exists_in_table(conn):
    result = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)

    session = await get_session(conn, result.id)

    assert session is not None
    assert session.active is True


async def test_passes_session_id(conn):
    parent_session_id = uuid4()
    result = await create_session(
        conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID, session_id=parent_session_id,
    )

    session = await get_session(conn, result.id)

    assert session is not None
    assert session.session_id == parent_session_id


async def test_passes_mcp_flag(conn):
    result = await create_session(
        conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID, mcp=True,
    )

    session = await get_session(conn, result.id)

    assert session is not None
    assert session.mcp is True
