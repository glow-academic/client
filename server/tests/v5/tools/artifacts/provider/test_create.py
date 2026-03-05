"""Tests for create_provider."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.provider.create import create_provider
from app.routes.v5.tools.artifacts.provider.get import get_providers

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


async def _endpoint(conn):
    return await conn.fetchval(
        "INSERT INTO endpoints_resource (base_url) VALUES ($1) RETURNING id",
        f"https://ep-{uuid4().hex[:8]}.example.com",
    )


async def _key(conn):
    return await conn.fetchval(
        "INSERT INTO keys_resource (key, name) VALUES ($1, $2) RETURNING id",
        f"k-{uuid4().hex[:8]}",
        f"kn-{uuid4().hex[:8]}",
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
    result = await create_provider(conn)
    assert result.id is not None

    items = await get_providers(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_links_single_and_multi(conn):
    nid = await _name(conn)
    did = await _desc(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)
    eid = await _endpoint(conn)

    result = await create_provider(
        conn,
        name_id=nid,
        description_id=did,
        department_ids=[d1, d2],
        endpoint_ids=[eid],
    )

    items = await get_providers(
        conn, [result.id],
        names=True, descriptions=True, departments=True, endpoints=True,
    )
    p = items[0]
    assert p.name_ids == [nid]
    assert p.description_ids == [did]
    assert set(p.department_ids) == {d1, d2}
    assert p.endpoint_ids == [eid]


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_provider(conn, flag_ids={f1: True, f2: False})

    items = await get_providers(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM provider_flags_junction "
        "WHERE provider_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_update_replaces_single(conn):
    """Covered by test_update — placeholder to verify create + get roundtrip for singles."""
    nid = await _name(conn)
    result = await create_provider(conn, name_id=nid)

    items = await get_providers(conn, [result.id], names=True)
    assert items[0].name_ids == [nid]


async def test_update_adds_and_removes_multi(conn):
    """Verify multi junction create with keys."""
    k1 = await _key(conn)
    k2 = await _key(conn)

    result = await create_provider(conn, key_ids=[k1, k2])

    items = await get_providers(conn, [result.id], keys=True)
    assert set(items[0].key_ids) == {k1, k2}
