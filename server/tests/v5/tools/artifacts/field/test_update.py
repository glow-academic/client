"""Tests for update_field."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.field.create import create_field
from app.routes.v5.tools.artifacts.field.get import get_fields
from app.routes.v5.tools.artifacts.field.update import update_field

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _name(conn):
    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
    )


async def _dept(conn):
    return await conn.fetchval(
        "INSERT INTO departments_resource DEFAULT VALUES RETURNING id"
    )


async def _flag(conn):
    return await conn.fetchval(
        "INSERT INTO flags_resource (name, description, icon) VALUES ($1, $2, $3) RETURNING id",
        f"f-{uuid4().hex[:8]}",
        "desc",
        "icon",
    )


async def _create_with_junctions(conn):
    """Create a field with single + multi junctions for update tests."""
    n = await _name(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_field(conn, name_id=n, department_ids=[d1, d2])
    return result.id, n, d1, d2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_updates_base_columns(conn):
    result = await create_field(conn)
    await update_field(conn, result.id, active=False, mcp=True)

    row = await conn.fetchrow(
        "SELECT active, mcp FROM field_artifact WHERE id = $1", result.id
    )
    assert row["active"] is False
    assert row["mcp"] is True


async def test_update_replaces_single(conn):
    fid, old_name, _, _ = await _create_with_junctions(conn)
    new_name = await _name(conn)

    await update_field(conn, fid, name_id=new_name)

    items = await get_fields(conn, [fid], names=True)
    assert items[0].name_ids == [new_name]

    old_active = await conn.fetchval(
        "SELECT active FROM field_names_junction "
        "WHERE field_id = $1 AND name_id = $2",
        fid, old_name,
    )
    assert old_active is False


async def test_update_adds_and_removes_multi(conn):
    fid, _, d1, d2 = await _create_with_junctions(conn)
    d3 = await _dept(conn)

    # Remove d2, add d3
    await update_field(conn, fid, department_ids=[d1, d3])

    items = await get_fields(conn, [fid], departments=True)
    assert set(items[0].department_ids) == {d1, d3}

    d2_active = await conn.fetchval(
        "SELECT active FROM field_departments_junction "
        "WHERE field_id = $1 AND department_id = $2",
        fid, d2,
    )
    assert d2_active is False


async def test_updates_flag_values(conn):
    f1 = await _flag(conn)
    result = await create_field(conn, flag_ids={f1: True})

    await update_field(conn, result.id, flag_ids={f1: False})

    val = await conn.fetchval(
        "SELECT value FROM field_flags_junction "
        "WHERE field_id = $1 AND flag_id = $2 AND active = true",
        result.id, f1,
    )
    assert val is False


async def test_multi_none_means_no_change(conn):
    fid, _, d1, d2 = await _create_with_junctions(conn)

    await update_field(conn, fid, department_ids=None)

    items = await get_fields(conn, [fid], departments=True)
    assert set(items[0].department_ids) == {d1, d2}
