"""Tests for update_department."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.department.create import create_department
from app.routes.v5.tools.artifacts.department.get import get_departments
from app.routes.v5.tools.artifacts.department.update import update_department

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


async def _settings(conn):
    return await conn.fetchval(
        "INSERT INTO settings_resource DEFAULT VALUES RETURNING id"
    )


async def _create_with_junctions(conn):
    """Create a department with single + multi junctions for update tests."""
    n = await _name(conn)
    s1 = await _settings(conn)
    s2 = await _settings(conn)

    result = await create_department(conn, name_id=n, settings_ids=[s1, s2])
    return result.id, n, s1, s2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_updates_base_columns(conn):
    result = await create_department(conn)
    await update_department(conn, result.id, active=False, mcp=True)

    row = await conn.fetchrow(
        "SELECT active, mcp FROM department_artifact WHERE id = $1", result.id
    )
    assert row["active"] is False
    assert row["mcp"] is True


async def test_replaces_single_select_junction(conn):
    did, old_name, _, _ = await _create_with_junctions(conn)
    new_name = await _name(conn)

    await update_department(conn, did, name_id=new_name)

    items = await get_departments(conn, [did], names=True)
    assert items[0].name_ids == [new_name]

    old_active = await conn.fetchval(
        "SELECT active FROM department_names_junction "
        "WHERE department_id = $1 AND name_id = $2",
        did, old_name,
    )
    assert old_active is False


async def test_skips_junction_when_unset(conn):
    did, name_id, _, _ = await _create_with_junctions(conn)

    # Update with no junction args — name should be untouched
    await update_department(conn, did)

    items = await get_departments(conn, [did], names=True)
    assert items[0].name_ids == [name_id]


async def test_deactivates_removed_multi_ids(conn):
    did, _, s1, s2 = await _create_with_junctions(conn)

    await update_department(conn, did, settings_ids=[s1])

    items = await get_departments(conn, [did], settings=True)
    assert items[0].settings_ids == [s1]

    s2_active = await conn.fetchval(
        "SELECT active FROM department_settings_junction "
        "WHERE department_id = $1 AND settings_id = $2",
        did, s2,
    )
    assert s2_active is False


async def test_adds_new_multi_ids(conn):
    did, _, s1, s2 = await _create_with_junctions(conn)
    s3 = await _settings(conn)

    await update_department(conn, did, settings_ids=[s1, s2, s3])

    items = await get_departments(conn, [did], settings=True)
    assert set(items[0].settings_ids) == {s1, s2, s3}


async def test_clears_all_multi_ids(conn):
    did, _, s1, s2 = await _create_with_junctions(conn)

    await update_department(conn, did, settings_ids=[])

    items = await get_departments(conn, [did], settings=True)
    assert items[0].settings_ids == []


async def test_updates_flag_values(conn):
    f1 = await _flag(conn)
    result = await create_department(conn, flag_ids={f1: True})

    await update_department(conn, result.id, flag_ids={f1: False})

    val = await conn.fetchval(
        "SELECT value FROM department_flags_junction "
        "WHERE department_id = $1 AND flag_id = $2 AND active = true",
        result.id, f1,
    )
    assert val is False


async def test_multi_none_means_no_change(conn):
    did, _, s1, s2 = await _create_with_junctions(conn)

    await update_department(conn, did, settings_ids=None)

    items = await get_departments(conn, [did], settings=True)
    assert set(items[0].settings_ids) == {s1, s2}
