"""Tests for create_field."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.field.create import create_field
from app.routes.v5.tools.artifacts.field.get import get_fields

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers — create resource rows with required NOT NULL columns
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


async def _flag(conn):
    return await conn.fetchval(
        "INSERT INTO flags_resource (name, description, icon) VALUES ($1, $2, $3) RETURNING id",
        f"f-{uuid4().hex[:8]}",
        "desc",
        "icon",
    )


async def _conditional_parameter(conn):
    param_id = await conn.fetchval(
        "INSERT INTO parameters_resource (name, description, value) "
        "VALUES ($1, $2, $3) RETURNING id",
        f"p-{uuid4().hex[:8]}",
        "desc",
        "val",
    )
    return await conn.fetchval(
        "INSERT INTO conditional_parameters_resource (parameter_id) "
        "VALUES ($1) RETURNING id",
        param_id,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_creates_bare_artifact(conn):
    result = await create_field(conn)
    assert result.id is not None

    items = await get_fields(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_links_single_and_multi(conn):
    nid = await _name(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_field(
        conn, name_id=nid, department_ids=[d1, d2]
    )

    items = await get_fields(
        conn, [result.id], names=True, departments=True
    )
    p = items[0]
    assert p.name_ids == [nid]
    assert set(p.department_ids) == {d1, d2}


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_field(conn, flag_ids={f1: True, f2: False})

    items = await get_fields(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM field_flags_junction "
        "WHERE field_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_links_conditional_parameters(conn):
    cp1 = await _conditional_parameter(conn)
    cp2 = await _conditional_parameter(conn)

    result = await create_field(conn, conditional_parameter_ids=[cp1, cp2])

    items = await get_fields(conn, [result.id], conditional_parameters=True)
    assert set(items[0].conditional_parameter_ids) == {cp1, cp2}


async def test_no_junctions_when_none_provided(conn):
    result = await create_field(conn)

    items = await get_fields(
        conn,
        [result.id],
        names=True, descriptions=True, departments=True,
        flags=True, conditional_parameters=True, fields=True,
    )
    p = items[0]
    assert p.name_ids == []
    assert p.description_ids == []
    assert p.department_ids == []
    assert p.flag_ids == []
    assert p.conditional_parameter_ids == []
    assert p.field_ids == []
