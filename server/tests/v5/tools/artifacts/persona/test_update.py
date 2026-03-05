"""Tests for update_persona."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.persona.create import create_persona
from app.routes.v5.tools.artifacts.persona.get import get_personas
from app.routes.v5.tools.artifacts.persona.update import update_persona

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _name(conn):
    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
    )


async def _color(conn):
    return await conn.fetchval(
        "INSERT INTO colors_resource (name, description, hex_code) VALUES ($1, $2, $3) RETURNING id",
        f"c-{uuid4().hex[:8]}",
        "desc",
        "#000000",
    )


async def _dept(conn):
    return await conn.fetchval(
        "INSERT INTO departments_resource DEFAULT VALUES RETURNING id"
    )


async def _example(conn):
    return await conn.fetchval(
        "INSERT INTO examples_resource (example) VALUES ('ex') RETURNING id"
    )


async def _flag(conn):
    return await conn.fetchval(
        "INSERT INTO flags_resource (name, description, icon) VALUES ($1, $2, $3) RETURNING id",
        f"f-{uuid4().hex[:8]}",
        "desc",
        "icon",
    )


async def _create_with_junctions(conn):
    """Create a persona with single + multi junctions for update tests."""
    n = await _name(conn)
    c = await _color(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_persona(conn, name_id=n, color_id=c, department_ids=[d1, d2])
    return result.id, n, c, d1, d2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_updates_base_columns(conn):
    result = await create_persona(conn)
    await update_persona(conn, result.id, active=False, mcp=True)

    row = await conn.fetchrow(
        "SELECT active, mcp FROM persona_artifact WHERE id = $1", result.id
    )
    assert row["active"] is False
    assert row["mcp"] is True


async def test_replaces_single_select_junction(conn):
    pid, old_name, _, _, _ = await _create_with_junctions(conn)
    new_name = await _name(conn)

    await update_persona(conn, pid, name_id=new_name)

    items = await get_personas(conn, [pid], names=True)
    assert items[0].name_ids == [new_name]

    old_active = await conn.fetchval(
        "SELECT active FROM persona_names_junction "
        "WHERE persona_id = $1 AND name_id = $2",
        pid, old_name,
    )
    assert old_active is False


async def test_keeps_unchanged_single_junction(conn):
    pid, name_id, _, _, _ = await _create_with_junctions(conn)

    await update_persona(conn, pid, name_id=name_id)

    items = await get_personas(conn, [pid], names=True)
    assert items[0].name_ids == [name_id]


async def test_skips_junction_when_unset(conn):
    pid, name_id, color_id, _, _ = await _create_with_junctions(conn)
    new_color = await _color(conn)

    # Update only color — name should be untouched
    await update_persona(conn, pid, color_id=new_color)

    items = await get_personas(conn, [pid], names=True, colors=True)
    assert items[0].name_ids == [name_id]
    assert items[0].color_ids == [new_color]


async def test_deactivates_removed_multi_ids(conn):
    pid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_persona(conn, pid, department_ids=[d1])

    items = await get_personas(conn, [pid], departments=True)
    assert items[0].department_ids == [d1]

    d2_active = await conn.fetchval(
        "SELECT active FROM persona_departments_junction "
        "WHERE persona_id = $1 AND department_id = $2",
        pid, d2,
    )
    assert d2_active is False


async def test_adds_new_multi_ids(conn):
    pid, _, _, d1, d2 = await _create_with_junctions(conn)
    d3 = await _dept(conn)

    await update_persona(conn, pid, department_ids=[d1, d2, d3])

    items = await get_personas(conn, [pid], departments=True)
    assert set(items[0].department_ids) == {d1, d2, d3}


async def test_clears_all_multi_ids(conn):
    pid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_persona(conn, pid, department_ids=[])

    items = await get_personas(conn, [pid], departments=True)
    assert items[0].department_ids == []


async def test_updates_examples_with_reorder(conn):
    e1 = await _example(conn)
    e2 = await _example(conn)
    result = await create_persona(conn, example_ids=[e1, e2])

    await update_persona(conn, result.id, example_ids=[e2, e1])

    rows = await conn.fetch(
        "SELECT example_id, idx FROM persona_examples_junction "
        "WHERE persona_id = $1 AND active = true ORDER BY idx",
        result.id,
    )
    assert rows[0]["example_id"] == e2 and rows[0]["idx"] == 0
    assert rows[1]["example_id"] == e1 and rows[1]["idx"] == 1


async def test_updates_flag_values(conn):
    f1 = await _flag(conn)
    result = await create_persona(conn, flag_ids={f1: True})

    await update_persona(conn, result.id, flag_ids={f1: False})

    val = await conn.fetchval(
        "SELECT value FROM persona_flags_junction "
        "WHERE persona_id = $1 AND flag_id = $2 AND active = true",
        result.id, f1,
    )
    assert val is False


async def test_multi_none_means_no_change(conn):
    pid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_persona(conn, pid, department_ids=None)

    items = await get_personas(conn, [pid], departments=True)
    assert set(items[0].department_ids) == {d1, d2}
