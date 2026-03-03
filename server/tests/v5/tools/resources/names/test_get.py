"""Tests for get_names."""

import pytest
from uuid import UUID

from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.create import create_names_internal

pytestmark = pytest.mark.asyncio


async def test_returns_items_for_valid_ids(conn):
    id_1 = await create_names_internal(conn, name="Alice")
    id_2 = await create_names_internal(conn, name="Bob")

    items = await get_names(conn, [id_1, id_2])

    assert len(items) == 2
    returned_ids = {item.id for item in items}
    assert returned_ids == {id_1, id_2}


async def test_returns_empty_for_empty_ids(conn):
    items = await get_names(conn, [])
    assert items == []


async def test_returns_empty_for_nonexistent_id(conn):
    fake_id = UUID("00000000-0000-0000-0000-000000000000")
    items = await get_names(conn, [fake_id])
    assert items == []


async def test_items_have_expected_fields(conn):
    name_id = await create_names_internal(conn, name="Alice")
    items = await get_names(conn, [name_id])

    assert len(items) == 1
    assert items[0].id == name_id
    assert items[0].name == "Alice"


async def test_does_not_return_other_items(conn):
    target_id = await create_names_internal(conn, name="Target")
    await create_names_internal(conn, name="Other")

    items = await get_names(conn, [target_id])

    assert len(items) == 1
    assert items[0].id == target_id
