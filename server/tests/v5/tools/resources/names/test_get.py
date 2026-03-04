"""Tests for get_names."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.names.get import get_names

pytestmark = pytest.mark.asyncio


async def test_gets_created_name(conn):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-for-get')
        RETURNING id
    """)

    items = await get_names(conn, [name_id])

    assert len(items) == 1
    assert items[0].id == name_id
    assert items[0].name == "test-name-for-get"
    assert items[0].active is True


async def test_returns_empty_for_missing_name(conn):
    items = await get_names(conn, [uuid4()])

    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_names(conn, [])

    assert items == []
