"""Tests for create_tool."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.tool.create import create_tool
from app.routes.v5.tools.artifacts.tool.get import get_tools

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


async def _operation(conn):
    return await conn.fetchval(
        "INSERT INTO operations_resource (operation) VALUES ($1) RETURNING id",
        f"op-{uuid4().hex[:8]}",
    )


async def _args(conn):
    return await conn.fetchval(
        "INSERT INTO args_resource (name, field_type) VALUES ($1, $2) RETURNING id",
        f"a-{uuid4().hex[:8]}",
        "string",
    )


async def _flag(conn):
    return await conn.fetchval(
        "INSERT INTO flags_resource (name, description, icon) VALUES ($1, $2, $3) RETURNING id",
        f"f-{uuid4().hex[:8]}",
        "desc",
        "icon",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_creates_bare_artifact(conn):
    result = await create_tool(conn)
    assert result.id is not None

    items = await get_tools(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_links_single_and_multi(conn):
    nid = await _name(conn)
    did = await _desc(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)
    oid = await _operation(conn)

    result = await create_tool(
        conn,
        name_id=nid,
        description_id=did,
        department_ids=[d1, d2],
        operation_ids=[oid],
    )

    items = await get_tools(
        conn, [result.id],
        names=True, descriptions=True, departments=True, operations=True,
    )
    t = items[0]
    assert t.name_ids == [nid]
    assert t.description_ids == [did]
    assert set(t.department_ids) == {d1, d2}
    assert t.operation_ids == [oid]


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_tool(conn, flag_ids={f1: True, f2: False})

    items = await get_tools(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM tool_flags_junction "
        "WHERE tool_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_update_replaces_single(conn):
    """Verify create + get roundtrip for singles."""
    nid = await _name(conn)
    result = await create_tool(conn, name_id=nid)

    items = await get_tools(conn, [result.id], names=True)
    assert items[0].name_ids == [nid]


async def test_update_adds_and_removes_multi(conn):
    """Verify multi junction create with args."""
    a1 = await _args(conn)
    a2 = await _args(conn)

    result = await create_tool(conn, args_ids=[a1, a2])

    items = await get_tools(conn, [result.id], args=True)
    assert set(items[0].args_ids) == {a1, a2}
