"""Tests for create_auth."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.auth.create import create_auth
from app.routes.v5.tools.artifacts.auth.get import get_auths

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers — create resource rows with required NOT NULL columns
# ---------------------------------------------------------------------------


async def _name(conn):
    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
    )


async def _slug(conn):
    return await conn.fetchval(
        "INSERT INTO slugs_resource (value) VALUES ($1) RETURNING id",
        f"s-{uuid4().hex[:8]}",
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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_creates_bare_artifact(conn):
    result = await create_auth(conn)
    assert result.id is not None

    items = await get_auths(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_links_single_and_multi(conn):
    nid = await _name(conn)
    sid = await _slug(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_auth(conn, name_id=nid, slug_id=sid, department_ids=[d1, d2])

    items = await get_auths(conn, [result.id], names=True, slugs=True, departments=True)
    p = items[0]
    assert p.name_ids == [nid]
    assert p.slug_ids == [sid]
    assert set(p.department_ids) == {d1, d2}


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_auth(conn, flag_ids={f1: True, f2: False})

    items = await get_auths(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM auth_flags_junction "
        "WHERE auth_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_no_junctions_when_none_provided(conn):
    result = await create_auth(conn)

    items = await get_auths(
        conn,
        [result.id],
        names=True, descriptions=True, departments=True,
        flags=True, items=True, protocols=True, slugs=True, auths=True,
    )
    p = items[0]
    assert p.name_ids == []
    assert p.department_ids == []
    assert p.flag_ids == []
    assert p.auth_ids == []
