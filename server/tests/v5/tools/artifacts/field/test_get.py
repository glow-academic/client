"""Tests for get_fields."""

import pytest

from app.routes.v5.tools.artifacts.field.get import get_fields
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _create_field(conn):
    field_id = await conn.fetchval(
        "INSERT INTO field_artifact (generated) VALUES (true) RETURNING id"
    )
    return field_id


async def test_returns_base_columns(conn):
    field_id = await _create_field(conn)
    items = await get_fields(conn, [field_id])

    assert len(items) == 1
    p = items[0]
    assert p.id == field_id
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.department_ids is None


async def test_returns_empty_for_unknown_id(conn):

    items = await get_fields(conn, [nonexistent_id()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_fields(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn):
    field_id = await _create_field(conn)
    items = await get_fields(conn, [field_id], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn):
    field_id = await _create_field(conn)
    items = await get_fields(
        conn,
        [field_id],
        names=True,
        descriptions=True,
        departments=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert p.description_ids is not None
    assert p.department_ids is not None
    # Unrequested junctions stay None
    assert p.flag_ids is None
    assert p.conditional_parameter_ids is None


async def test_no_junctions_when_all_false(conn):
    field_id = await _create_field(conn)
    items = await get_fields(conn, [field_id])

    p = items[0]
    for field in [
        "name_ids", "description_ids", "department_ids", "flag_ids",
        "conditional_parameter_ids", "field_ids",
    ]:
        assert getattr(p, field) is None
