"""Tests for create_persona."""

import pytest

from app.routes.v5.tools.entries.persona.create import create_persona
from tests.seed_ids import STUDENT_PERSONA_ID

pytestmark = pytest.mark.asyncio


async def test_returns_id(conn):
    result = await create_persona(conn)

    assert result.id is not None


async def test_links_personas_resource(conn):
    result = await create_persona(conn, personas_id=STUDENT_PERSONA_ID)

    row = await conn.fetchrow(
        "SELECT personas_id FROM personas_personas_connection WHERE personas_entry_id = $1",
        result.id,
    )
    assert row is not None
    assert row["personas_id"] == STUDENT_PERSONA_ID


async def test_passes_mcp_flag(conn):
    result = await create_persona(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM personas_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
