"""Tests for get_personas."""

import pytest

from app.routes.v5.tools.artifacts.persona.get import get_personas
from tests.seed_ids import SEED_PERSONA_ARTIFACT_ID

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn):
    items = await get_personas(conn, [SEED_PERSONA_ARTIFACT_ID])

    assert len(items) == 1
    p = items[0]
    assert p.id == SEED_PERSONA_ARTIFACT_ID
    assert p.active is True
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.color_ids is None


async def test_returns_empty_for_unknown_id(conn):
    from uuid import uuid4

    items = await get_personas(conn, [uuid4()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_personas(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn):
    items = await get_personas(conn, [SEED_PERSONA_ARTIFACT_ID], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert len(p.name_ids) > 0
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn):
    items = await get_personas(
        conn,
        [SEED_PERSONA_ARTIFACT_ID],
        names=True,
        descriptions=True,
        colors=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # descriptions and colors may be empty lists if no seed data, but not None
    assert p.description_ids is not None
    assert p.color_ids is not None
    # Unrequested junctions stay None
    assert p.flag_ids is None
    assert p.voice_ids is None


async def test_no_junctions_when_all_false(conn):
    items = await get_personas(conn, [SEED_PERSONA_ARTIFACT_ID])

    p = items[0]
    for field in [
        "name_ids", "description_ids", "color_ids", "department_ids",
        "example_ids", "flag_ids", "icon_ids", "instruction_ids",
        "parameter_field_ids", "persona_ids", "voice_ids",
    ]:
        assert getattr(p, field) is None
