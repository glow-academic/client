"""Tests for get_name."""

import pytest

from app.routes.v5.tools.resources.names.get import get_name

pytestmark = pytest.mark.asyncio


async def test_gets_created_name(conn):
    name_id = await conn.fetchval("""
        INSERT INTO names_resource (name) VALUES ('test-name-for-get')
        RETURNING id
    """)

    name = await get_name(conn, name_id)

    assert name is not None
    assert name.id == name_id
    assert name.name == "test-name-for-get"
    assert name.active is True


async def test_returns_none_for_missing_name(conn):
    from uuid import uuid4

    name = await get_name(conn, uuid4())

    assert name is None
