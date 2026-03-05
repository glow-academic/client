"""Tests for update_model."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.model.create import create_model
from app.routes.v5.tools.artifacts.model.get import get_models
from app.routes.v5.tools.artifacts.model.update import update_model

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


async def _voice(conn):
    return await conn.fetchval(
        "INSERT INTO voices_resource (voice) VALUES ($1) RETURNING id",
        f"v-{uuid4().hex[:8]}",
    )


async def _create_with_junctions(conn):
    """Create a model with single + multi junctions for update tests."""
    n = await _name(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_model(conn, name_id=n, department_ids=[d1, d2])
    return result.id, n, d1, d2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_updates_base_columns(conn):
    result = await create_model(conn)
    await update_model(conn, result.id, active=False, mcp=True)

    row = await conn.fetchrow(
        "SELECT active, mcp FROM model_artifact WHERE id = $1", result.id
    )
    assert row["active"] is False
    assert row["mcp"] is True


async def test_update_replaces_single(conn):
    mid, old_name, _, _ = await _create_with_junctions(conn)
    new_name = await _name(conn)

    await update_model(conn, mid, name_id=new_name)

    items = await get_models(conn, [mid], names=True)
    assert items[0].name_ids == [new_name]

    old_active = await conn.fetchval(
        "SELECT active FROM model_names_junction "
        "WHERE model_id = $1 AND name_id = $2",
        mid, old_name,
    )
    assert old_active is False


async def test_update_adds_and_removes_multi(conn):
    mid, _, d1, d2 = await _create_with_junctions(conn)
    d3 = await _dept(conn)

    # Remove d2, add d3
    await update_model(conn, mid, department_ids=[d1, d3])

    items = await get_models(conn, [mid], departments=True)
    assert set(items[0].department_ids) == {d1, d3}

    d2_active = await conn.fetchval(
        "SELECT active FROM model_departments_junction "
        "WHERE model_id = $1 AND department_id = $2",
        mid, d2,
    )
    assert d2_active is False


async def test_updates_flag_values(conn):
    f1 = await _flag(conn)
    result = await create_model(conn, flag_ids={f1: True})

    await update_model(conn, result.id, flag_ids={f1: False})

    val = await conn.fetchval(
        "SELECT value FROM model_flags_junction "
        "WHERE model_id = $1 AND flag_id = $2 AND active = true",
        result.id, f1,
    )
    assert val is False


async def test_multi_none_means_no_change(conn):
    mid, _, d1, d2 = await _create_with_junctions(conn)

    await update_model(conn, mid, department_ids=None)

    items = await get_models(conn, [mid], departments=True)
    assert set(items[0].department_ids) == {d1, d2}
