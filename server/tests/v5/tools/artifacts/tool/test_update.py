"""Tests for update_tool."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.tool.create import create_tool
from app.routes.v5.tools.artifacts.tool.get import get_tools
from app.routes.v5.tools.artifacts.tool.update import update_tool

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _name(conn):
    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
    )


async def _desc(conn):
    return await conn.fetchval(
        "INSERT INTO descriptions_resource (description) VALUES ($1) RETURNING id",
        f"d-{uuid4().hex[:8]}",
    )


async def _dept(conn):
    return await conn.fetchval(
        "INSERT INTO departments_resource DEFAULT VALUES RETURNING id"
    )


async def _operation(conn):
    return await conn.fetchval(
        "INSERT INTO operations_resource (operation) VALUES ($1) RETURNING id",
        f"op-{uuid4().hex[:8]}",
    )


async def _flag(conn):
    return await conn.fetchval(
        "INSERT INTO flags_resource (name, description, icon) VALUES ($1, $2, $3) RETURNING id",
        f"f-{uuid4().hex[:8]}",
        "desc",
        "icon",
    )


async def _create_with_junctions(conn):
    """Create a tool with single + multi junctions for update tests."""
    n = await _name(conn)
    d = await _desc(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_tool(
        conn, name_id=n, description_id=d, department_ids=[d1, d2]
    )
    return result.id, n, d, d1, d2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_updates_base_columns(conn):
    result = await create_tool(conn)
    await update_tool(conn, result.id, active=False, mcp=True)

    row = await conn.fetchrow(
        "SELECT active, mcp FROM tool_artifact WHERE id = $1", result.id
    )
    assert row["active"] is False
    assert row["mcp"] is True


async def test_replaces_single_select_junction(conn):
    tid, old_name, _, _, _ = await _create_with_junctions(conn)
    new_name = await _name(conn)

    await update_tool(conn, tid, name_id=new_name)

    items = await get_tools(conn, [tid], names=True)
    assert items[0].name_ids == [new_name]

    old_active = await conn.fetchval(
        "SELECT active FROM tool_names_junction "
        "WHERE tool_id = $1 AND name_id = $2",
        tid, old_name,
    )
    assert old_active is False


async def test_skips_junction_when_unset(conn):
    tid, name_id, desc_id, _, _ = await _create_with_junctions(conn)
    new_desc = await _desc(conn)

    # Update only description — name should be untouched
    await update_tool(conn, tid, description_id=new_desc)

    items = await get_tools(conn, [tid], names=True, descriptions=True)
    assert items[0].name_ids == [name_id]
    assert items[0].description_ids == [new_desc]


async def test_deactivates_removed_multi_ids(conn):
    tid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_tool(conn, tid, department_ids=[d1])

    items = await get_tools(conn, [tid], departments=True)
    assert items[0].department_ids == [d1]

    d2_active = await conn.fetchval(
        "SELECT active FROM tool_departments_junction "
        "WHERE tool_id = $1 AND department_id = $2",
        tid, d2,
    )
    assert d2_active is False


async def test_adds_new_multi_ids(conn):
    tid, _, _, d1, d2 = await _create_with_junctions(conn)
    d3 = await _dept(conn)

    await update_tool(conn, tid, department_ids=[d1, d2, d3])

    items = await get_tools(conn, [tid], departments=True)
    assert set(items[0].department_ids) == {d1, d2, d3}


async def test_clears_all_multi_ids(conn):
    tid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_tool(conn, tid, department_ids=[])

    items = await get_tools(conn, [tid], departments=True)
    assert items[0].department_ids == []


async def test_updates_flag_values(conn):
    f1 = await _flag(conn)
    result = await create_tool(conn, flag_ids={f1: True})

    await update_tool(conn, result.id, flag_ids={f1: False})

    val = await conn.fetchval(
        "SELECT value FROM tool_flags_junction "
        "WHERE tool_id = $1 AND flag_id = $2 AND active = true",
        result.id, f1,
    )
    assert val is False


async def test_multi_none_means_no_change(conn):
    tid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_tool(conn, tid, department_ids=None)

    items = await get_tools(conn, [tid], departments=True)
    assert set(items[0].department_ids) == {d1, d2}
