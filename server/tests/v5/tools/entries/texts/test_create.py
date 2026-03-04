"""Tests for create_text."""

import pytest

from app.routes.v5.tools.entries.texts.create import create_text
from app.routes.v5.tools.entries.texts.get import get_text
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_creates_text_entry(conn):
    session = await _session(conn)
    result = await create_text(conn, session_id=session.id)

    assert result.id is not None


async def test_text_exists_in_table(conn):
    session = await _session(conn)
    result = await create_text(conn, session_id=session.id)

    text = await get_text(conn, result.id)

    assert text is not None
    assert text.session_id == session.id
    assert text.active is True


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    result = await create_text(conn, session_id=session.id, mcp=True)

    text = await get_text(conn, result.id)

    assert text is not None
    assert text.mcp is True
