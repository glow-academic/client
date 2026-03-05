"""Tests for create_department."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.department.create import create_department
from app.routes.v5.tools.artifacts.department.get import get_departments

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


async def _settings(conn):
    return await conn.fetchval(
        "INSERT INTO settings_resource DEFAULT VALUES RETURNING id"
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_creates_bare_artifact(conn):
    result = await create_department(conn)
    assert result.id is not None

    items = await get_departments(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_links_single_and_multi(conn):
    nid = await _name(conn)
    s1 = await _settings(conn)
    s2 = await _settings(conn)

    result = await create_department(conn, name_id=nid, settings_ids=[s1, s2])

    items = await get_departments(conn, [result.id], names=True, settings=True)
    p = items[0]
    assert p.name_ids == [nid]
    assert set(p.settings_ids) == {s1, s2}


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_department(conn, flag_ids={f1: True, f2: False})

    items = await get_departments(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM department_flags_junction "
        "WHERE department_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_no_junctions_when_none_provided(conn):
    result = await create_department(conn)

    items = await get_departments(
        conn,
        [result.id],
        names=True, descriptions=True, flags=True,
        settings=True, departments=True,
    )
    p = items[0]
    assert p.name_ids == []
    assert p.flag_ids == []
    assert p.settings_ids == []
    assert p.department_ids == []
